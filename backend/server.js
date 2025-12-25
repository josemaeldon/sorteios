const express = require('express');
const cors = require('cors');
const DatabaseAdapter = require('./db-adapter');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Basic-Auth'],
}));

app.use(express.json());

// Database configuration file path
const DB_CONFIG_PATH = path.join(__dirname, 'db-config.json');

// Function to load database configuration
function loadDbConfig() {
  if (fs.existsSync(DB_CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(DB_CONFIG_PATH, 'utf8'));
      return config;
    } catch (error) {
      console.error('Error loading database config:', error);
      return null;
    }
  }
  return null;
}

// Function to save database configuration
function saveDbConfig(config) {
  try {
    fs.writeFileSync(DB_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving database config:', error);
    return false;
  }
}

// Load database configuration from file or environment
let dbConfig = loadDbConfig();
if (!dbConfig && process.env.DB_HOST) {
  // Use environment variables if no config file exists
  dbConfig = {
    type: process.env.DB_TYPE || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (process.env.DB_TYPE === 'mysql' ? '3306' : '5432')),
    database: process.env.DB_NAME || 'bingo',
    user: process.env.DB_USER || (process.env.DB_TYPE === 'mysql' ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || '',
  };
}

// Database adapter (will be null if not configured)
let dbAdapter = null;
if (dbConfig) {
  try {
    dbAdapter = new DatabaseAdapter(dbConfig);
    dbAdapter.connect();
    console.log(`Database adapter initialized for ${dbConfig.type}`);
  } catch (error) {
    console.error('Error initializing database adapter:', error);
  }
}

// Basic Auth credentials from environment
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'bingo_jwt_secret_2024_secure';
const JWT_EXPIRY_HOURS = 24;

// ================== Utility Functions ==================

async function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password + 'bingo_salt_2024');
  return hash.digest('hex');
}

async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }
  return Buffer.from(padded, 'base64');
}

async function createJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (JWT_EXPIRY_HOURS * 60 * 60),
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(signatureInput);
  const signatureB64 = base64UrlEncode(hmac.digest());

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Verify signature
    const signatureInput = `${headerB64}.${payloadB64}`;
    const hmac = crypto.createHmac('sha256', JWT_SECRET);
    hmac.update(signatureInput);
    const expectedSignature = base64UrlEncode(hmac.digest());
    
    if (signatureB64 !== expectedSignature) return null;

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString());

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log('Token expired');
      return null;
    }

    return { user_id: payload.user_id, role: payload.role, email: payload.email };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// ================== Middleware ==================

// Basic Auth middleware (optional)
function checkBasicAuth(req, res, next) {
  // If no basic auth configured, skip
  if (!BASIC_AUTH_USER) {
    return next();
  }

  const basicAuth = req.headers['x-basic-auth'];
  if (!basicAuth) {
    return res.status(401).json({ error: 'Basic authentication required' });
  }

  try {
    const credentials = Buffer.from(basicAuth.replace('Basic ', ''), 'base64').toString();
    const [user, pass] = credentials.split(':');
    
    if (user !== BASIC_AUTH_USER || pass !== BASIC_AUTH_PASS) {
      return res.status(401).json({ error: 'Invalid basic auth credentials' });
    }
    
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid basic auth format' });
  }
}

// JWT Auth middleware
async function checkAuth(req, action) {
  const publicActions = ['checkFirstAccess', 'setupAdmin', 'login', 'checkDbConfig', 'testDbConnection', 'saveDbConfig', 'initializeDatabase'];
  const adminActions = ['getUsers', 'createUser', 'updateUser', 'deleteUser'];
  
  if (publicActions.includes(action)) {
    return { authenticated: true, user: null };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Não autorizado. Faça login novamente.' };
  }

  const token = authHeader.substring(7);
  const user = await verifyJwt(token);
  
  if (!user) {
    return { authenticated: false, error: 'Token inválido ou expirado.' };
  }

  if (adminActions.includes(action) && user.role !== 'admin') {
    return { authenticated: false, error: 'Acesso negado. Apenas administradores.' };
  }

  return { authenticated: true, user };
}

// ================== Routes ==================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api', checkBasicAuth, async (req, res) => {
  const { action, data = {} } = req.body;
  
  console.log(`API Call: ${action}`);
  
  // Actions that don't require database
  const dbConfigActions = ['checkDbConfig', 'testDbConnection', 'saveDbConfig', 'initializeDatabase'];
  
  // Check if database is configured for actions that need it
  if (!dbConfigActions.includes(action) && !dbAdapter) {
    return res.status(503).json({ 
      error: 'Banco de dados não configurado',
      needsDbConfig: true 
    });
  }
  
  // Handle database configuration actions
  if (dbConfigActions.includes(action)) {
    try {
      let result;
      
      switch (action) {
        case 'checkDbConfig':
          return res.json({ 
            configured: !!dbAdapter,
            config: dbAdapter ? {
              type: dbConfig.type,
              host: dbConfig.host,
              port: dbConfig.port,
              database: dbConfig.database,
              user: dbConfig.user
            } : null
          });
        
        case 'testDbConnection': {
          const testConfig = {
            type: data.type || 'postgres',
            host: data.host,
            port: parseInt(data.port),
            database: data.database,
            user: data.user,
            password: data.password,
          };
          
          let testAdapter = null;
          try {
            testAdapter = new DatabaseAdapter(testConfig);
            await testAdapter.connect();
            await testAdapter.query('SELECT 1');
            await testAdapter.end();
            return res.json({ success: true, message: 'Conexão estabelecida com sucesso!' });
          } catch (error) {
            if (testAdapter) {
              try { await testAdapter.end(); } catch (e) {}
            }
            return res.json({ 
              success: false, 
              error: `Erro ao conectar: ${error.message}` 
            });
          }
        }
        
        case 'saveDbConfig': {
          const newConfig = {
            type: data.type || 'postgres',
            host: data.host,
            port: parseInt(data.port),
            database: data.database,
            user: data.user,
            password: data.password,
          };
          
          if (saveDbConfig(newConfig)) {
            // Reinitialize adapter with new configuration
            if (dbAdapter) {
              await dbAdapter.end();
            }
            dbConfig = newConfig;
            dbAdapter = new DatabaseAdapter(dbConfig);
            await dbAdapter.connect();
            
            return res.json({ success: true, message: 'Configuração salva com sucesso!' });
          } else {
            return res.json({ success: false, error: 'Erro ao salvar configuração' });
          }
        }
        
        case 'initializeDatabase': {
          if (!dbAdapter) {
            return res.status(503).json({ error: 'Banco de dados não configurado' });
          }
          
          const client = await dbAdapter.getConnection();
          try {
            // Read and execute the database initialization script based on DB type
            const scriptName = dbConfig.type === 'mysql' ? 'init-mysql.sql' : 'init-postgres.sql';
            const initScriptPath = path.join(__dirname, '..', 'database', scriptName);
            
            if (!fs.existsSync(initScriptPath)) {
              throw new Error('Arquivo de inicialização do banco de dados não encontrado: ' + initScriptPath);
            }
            
            const initScript = fs.readFileSync(initScriptPath, 'utf8');
            
            // For PostgreSQL, we can execute the entire script at once
            if (dbConfig.type === 'postgres') {
              await client.query(initScript);
            } else {
              // For MySQL, split by semicolon but be careful with string literals
              // This is a simple approach - for complex scripts, consider a proper SQL parser
              const statements = initScript
                .split(/;[\s]*(\n|$)/)  // Split on semicolon followed by optional whitespace and newline
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--') && s !== '\n');
              
              for (const statement of statements) {
                if (statement.trim()) {
                  try {
                    await client.query(statement);
                  } catch (err) {
                    console.error('Error executing statement:', statement.substring(0, 100), err.message);
                    throw err;
                  }
                }
              }
            }
            
            client.release();
            
            return res.json({ success: true, message: 'Banco de dados inicializado com sucesso!' });
          } catch (error) {
            client.release();
            console.error('Database initialization error:', error);
            return res.json({ 
              success: false, 
              error: `Erro ao inicializar banco de dados: ${error.message}` 
            });
          }
        }
      }
    } catch (error) {
      console.error('Database config error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Check authentication
  const authResult = await checkAuth(req, action);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: authResult.error });
  }
  
  // Add authenticated user info to data
  if (authResult.user) {
    data.authenticated_user_id = authResult.user.user_id;
    data.authenticated_role = authResult.user.role;
  }

  const client = await dbAdapter.getConnection();
  
  try {
    let result;
    
    switch (action) {
      // ================== AUTH ==================
      case 'checkFirstAccess':
        result = await client.query('SELECT COUNT(*) as count FROM usuarios');
        return res.json({ isFirstAccess: parseInt(result.rows[0].count) === 0 });

      case 'setupAdmin': {
        const existingCheck = await client.query('SELECT COUNT(*) as count FROM usuarios');
        if (parseInt(existingCheck.rows[0].count) > 0) {
          return res.json({ error: 'Administrador já existe' });
        }
        
        const adminHash = await hashPassword(data.senha);
        const adminResult = await client.query(`
          INSERT INTO usuarios (email, senha_hash, nome, role, ativo, titulo_sistema)
          VALUES ($1, $2, $3, 'admin', true, $4)
          RETURNING id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at
        `, [data.email, adminHash, data.nome, data.titulo_sistema || 'Sorteios']);
        
        return res.json({ user: adminResult.rows[0] });
      }

      case 'login': {
        const userResult = await client.query(`
          SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, senha_hash, created_at 
          FROM usuarios WHERE email = $1
        `, [data.email]);
        
        if (userResult.rows.length === 0) {
          return res.json({ error: 'Credenciais inválidas' });
        }
        
        const foundUser = userResult.rows[0];
        const passwordValid = await verifyPassword(data.senha, foundUser.senha_hash);
        
        if (!passwordValid) {
          return res.json({ error: 'Credenciais inválidas' });
        }
        
        if (!foundUser.ativo) {
          return res.json({ error: 'Usuário inativo. Contate o administrador.' });
        }
        
        const token = await createJwt({
          user_id: foundUser.id,
          role: foundUser.role,
          email: foundUser.email
        });
        
        delete foundUser.senha_hash;
        
        console.log(`User ${foundUser.email} logged in successfully`);
        return res.json({ user: foundUser, token });
      }

      case 'getUsers':
        result = await client.query(`
          SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at, updated_at 
          FROM usuarios ORDER BY nome
        `);
        return res.json({ users: result.rows });

      case 'createUser': {
        const newUserHash = await hashPassword(data.senha);
        const newUserResult = await client.query(`
          INSERT INTO usuarios (email, senha_hash, nome, role, ativo, titulo_sistema, avatar_url)
          VALUES ($1, $2, $3, $4, true, $5, $6)
          RETURNING id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at
        `, [data.email, newUserHash, data.nome, data.role, data.titulo_sistema || 'Sorteios', data.avatar_url || null]);
        
        return res.json({ user: newUserResult.rows[0] });
      }

      case 'updateUser': {
        if (data.senha) {
          const updateHash = await hashPassword(data.senha);
          await client.query(`
            UPDATE usuarios SET email = $2, nome = $3, role = $4, senha_hash = $5, titulo_sistema = $6, updated_at = NOW()
            WHERE id = $1
          `, [data.id, data.email, data.nome, data.role, updateHash, data.titulo_sistema || 'Sorteios']);
        } else {
          await client.query(`
            UPDATE usuarios SET email = $2, nome = $3, role = $4, titulo_sistema = $5, updated_at = NOW()
            WHERE id = $1
          `, [data.id, data.email, data.nome, data.role, data.titulo_sistema || 'Sorteios']);
        }
        
        return res.json({ success: true });
      }

      case 'deleteUser':
        await client.query('DELETE FROM usuarios WHERE id = $1', [data.id]);
        return res.json({ success: true });

      case 'updateProfile': {
        const profileUserId = data.authenticated_user_id;
        
        if (data.nova_senha) {
          const currentUserResult = await client.query(
            'SELECT senha_hash FROM usuarios WHERE id = $1',
            [profileUserId]
          );
          
          if (currentUserResult.rows.length === 0) {
            return res.json({ error: 'Usuário não encontrado' });
          }
          
          const senhaValida = await verifyPassword(data.senha_atual, currentUserResult.rows[0].senha_hash);
          
          if (!senhaValida) {
            return res.json({ error: 'Senha atual incorreta' });
          }
          
          const newHash = await hashPassword(data.nova_senha);
          await client.query(`
            UPDATE usuarios SET nome = $2, email = $3, titulo_sistema = $4, avatar_url = $5, senha_hash = $6, updated_at = NOW()
            WHERE id = $1
          `, [profileUserId, data.nome, data.email, data.titulo_sistema, data.avatar_url || null, newHash]);
        } else {
          await client.query(`
            UPDATE usuarios SET nome = $2, email = $3, titulo_sistema = $4, avatar_url = $5, updated_at = NOW()
            WHERE id = $1
          `, [profileUserId, data.nome, data.email, data.titulo_sistema, data.avatar_url || null]);
        }
        
        return res.json({ success: true });
      }

      // ================== SORTEIOS ==================
      case 'getSorteios':
        result = await client.query(
          'SELECT * FROM sorteios WHERE user_id = $1 ORDER BY created_at DESC',
          [data.authenticated_user_id]
        );
        return res.json({ data: result.rows });

      case 'createSorteio': {
        const premiosCreate = data.premios || (data.premio ? [data.premio] : []);
        const premioCreate = premiosCreate[0] || '';
        
        result = await client.query(`
          INSERT INTO sorteios (user_id, nome, data_sorteio, premio, premios, valor_cartela, quantidade_cartelas, status)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
          RETURNING *
        `, [data.authenticated_user_id, data.nome, data.data_sorteio, premioCreate, JSON.stringify(premiosCreate), data.valor_cartela, data.quantidade_cartelas, data.status]);
        
        const newSorteioId = result.rows[0].id;
        const quantidadeCartelas = Number(data.quantidade_cartelas || 0);
        
        // Generate cartelas in batches
        const batchSize = 500;
        for (let batch = 0; batch < Math.ceil(quantidadeCartelas / batchSize); batch++) {
          const startNum = batch * batchSize + 1;
          const endNum = Math.min((batch + 1) * batchSize, quantidadeCartelas);
          
          const values = [];
          const params = [newSorteioId];
          let paramIndex = 2;
          
          for (let i = startNum; i <= endNum; i++) {
            values.push(`($1, $${paramIndex}, 'disponivel')`);
            params.push(i);
            paramIndex++;
          }
          
          if (values.length > 0) {
            await client.query(
              `INSERT INTO cartelas (sorteio_id, numero, status) VALUES ${values.join(', ')}`,
              params
            );
          }
        }
        
        return res.json({ data: result.rows });
      }

      case 'updateSorteio': {
        const premiosUpdate = data.premios || (data.premio ? [data.premio] : []);
        const premioUpdate = premiosUpdate[0] || '';
        
        result = await client.query(`
          UPDATE sorteios 
          SET nome = $2, data_sorteio = $3, premio = $4, premios = $5::jsonb, valor_cartela = $6, quantidade_cartelas = $7, status = $8, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.nome, data.data_sorteio, premioUpdate, JSON.stringify(premiosUpdate), data.valor_cartela, data.quantidade_cartelas, data.status]);
        return res.json({ data: result.rows });
      }

      case 'deleteSorteio':
        await client.query('DELETE FROM sorteios WHERE id = $1', [data.id]);
        return res.json({ data: [{ success: true }] });

      // ================== DRAW HISTORY ==================
      case 'getSorteioHistorico':
        result = await client.query(
          'SELECT * FROM sorteio_historico WHERE sorteio_id = $1 ORDER BY ordem ASC',
          [data.sorteio_id]
        );
        return res.json({ data: result.rows });

      case 'saveSorteioNumero': {
        const { sorteio_id, numero_sorteado, range_start, range_end, ordem, registro } = data;
        result = await client.query(`
          INSERT INTO sorteio_historico (sorteio_id, numero_sorteado, range_start, range_end, ordem, registro)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [sorteio_id, numero_sorteado, range_start, range_end, ordem, registro ?? null]);
        return res.json({ data: result.rows[0] });
      }

      case 'clearSorteioHistorico':
        await client.query('DELETE FROM sorteio_historico WHERE sorteio_id = $1', [data.sorteio_id]);
        return res.json({ data: [{ success: true }] });

      case 'updateSorteioRegistro':
        await client.query(
          'UPDATE sorteio_historico SET registro = $1 WHERE sorteio_id = $2',
          [data.registro, data.sorteio_id]
        );
        return res.json({ data: [{ success: true }] });

      // ================== RODADAS DE SORTEIO ==================
      case 'getRodadas':
        result = await client.query(
          'SELECT * FROM rodadas_sorteio WHERE sorteio_id = $1 ORDER BY created_at DESC',
          [data.sorteio_id]
        );
        return res.json({ data: result.rows });

      case 'createRodada':
        result = await client.query(`
          INSERT INTO rodadas_sorteio (sorteio_id, nome, range_start, range_end, status, data_inicio)
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING *
        `, [data.sorteio_id, data.nome, data.range_start, data.range_end, data.status || 'ativo']);
        return res.json({ data: result.rows[0] });

      case 'updateRodada':
        result = await client.query(`
          UPDATE rodadas_sorteio 
          SET nome = $2, range_start = $3, range_end = $4, status = $5, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.nome, data.range_start, data.range_end, data.status]);
        return res.json({ data: result.rows[0] });

      case 'deleteRodada':
        await client.query('DELETE FROM rodadas_sorteio WHERE id = $1', [data.id]);
        return res.json({ data: [{ success: true }] });

      case 'getRodadaHistorico':
        result = await client.query(
          'SELECT * FROM sorteio_historico WHERE rodada_id = $1 ORDER BY ordem ASC',
          [data.rodada_id]
        );
        return res.json({ data: result.rows });

      case 'saveRodadaNumero': {
        const { rodada_id, numero_sorteado, ordem } = data;
        
        // Get rodada information to extract range values
        const rodadaInfo = await client.query(
          'SELECT range_start, range_end FROM rodadas_sorteio WHERE id = $1',
          [rodada_id]
        );
        
        if (rodadaInfo.rows.length === 0) {
          return res.status(404).json({ error: 'Rodada não encontrada' });
        }
        
        const { range_start, range_end } = rodadaInfo.rows[0];
        
        result = await client.query(`
          INSERT INTO sorteio_historico (rodada_id, numero_sorteado, range_start, range_end, ordem, data_sorteio)
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING *
        `, [rodada_id, numero_sorteado, range_start, range_end, ordem]);
        return res.json({ data: result.rows[0] });
      }

      case 'clearRodadaHistorico':
        await client.query('DELETE FROM sorteio_historico WHERE rodada_id = $1', [data.rodada_id]);
        return res.json({ data: [{ success: true }] });

      // ================== VENDEDORES ==================
      case 'getVendedores':
        result = await client.query(
          'SELECT * FROM vendedores WHERE sorteio_id = $1 ORDER BY nome',
          [data.sorteio_id]
        );
        return res.json({ data: result.rows });

      case 'createVendedor':
        result = await client.query(`
          INSERT INTO vendedores (sorteio_id, nome, telefone, email, cpf, endereco, ativo)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [data.sorteio_id, data.nome, data.telefone, data.email, data.cpf, data.endereco, data.ativo]);
        return res.json({ data: result.rows });

      case 'updateVendedor':
        result = await client.query(`
          UPDATE vendedores 
          SET nome = $2, telefone = $3, email = $4, cpf = $5, endereco = $6, ativo = $7, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.nome, data.telefone, data.email, data.cpf, data.endereco, data.ativo]);
        return res.json({ data: result.rows });

      case 'deleteVendedor':
        await client.query('DELETE FROM vendedores WHERE id = $1', [data.id]);
        return res.json({ data: [{ success: true }] });

      // ================== CARTELAS ==================
      case 'getCartelas':
        result = await client.query(
          'SELECT * FROM cartelas WHERE sorteio_id = $1 ORDER BY numero',
          [data.sorteio_id]
        );
        return res.json({ data: result.rows });

      case 'updateCartela':
        result = await client.query(`
          UPDATE cartelas 
          SET status = $2, vendedor_id = $3, updated_at = NOW()
          WHERE sorteio_id = $1 AND numero = $4
          RETURNING *
        `, [data.sorteio_id, data.status, data.vendedor_id, data.numero]);
        return res.json({ data: result.rows });

      case 'updateCartelasBatch':
        for (const cartela of data.cartelas) {
          await client.query(`
            UPDATE cartelas 
            SET status = $2, vendedor_id = $3, updated_at = NOW()
            WHERE sorteio_id = $1 AND numero = $4
          `, [data.sorteio_id, cartela.status, cartela.vendedor_id, cartela.numero]);
        }
        return res.json({ data: [{ success: true }] });

      case 'gerarCartelas': {
        await client.query('DELETE FROM cartelas WHERE sorteio_id = $1', [data.sorteio_id]);
        
        const batchSize = 500;
        const totalCartelas = Number(data.quantidade || 0);
        
        for (let batch = 0; batch < Math.ceil(totalCartelas / batchSize); batch++) {
          const startNum = batch * batchSize + 1;
          const endNum = Math.min((batch + 1) * batchSize, totalCartelas);
          
          const values = [];
          const params = [data.sorteio_id];
          let paramIndex = 2;
          
          for (let i = startNum; i <= endNum; i++) {
            values.push(`($1, $${paramIndex}, 'disponivel')`);
            params.push(i);
            paramIndex++;
          }
          
          if (values.length > 0) {
            await client.query(
              `INSERT INTO cartelas (sorteio_id, numero, status) VALUES ${values.join(', ')}`,
              params
            );
          }
        }
        
        return res.json({ data: [{ success: true, quantidade: totalCartelas }] });
      }

      // ================== ATRIBUIÇÕES ==================
      case 'getAtribuicoes':
        result = await client.query(`
          SELECT a.*, v.nome as vendedor_nome,
            COALESCE(json_agg(
              json_build_object(
                'numero', ac.numero_cartela,
                'status', ac.status,
                'data_atribuicao', ac.data_atribuicao,
                'data_devolucao', ac.data_devolucao,
                'venda_id', ac.venda_id
              ) ORDER BY ac.numero_cartela
            ) FILTER (WHERE ac.id IS NOT NULL), '[]') as cartelas
          FROM atribuicoes a
          LEFT JOIN vendedores v ON a.vendedor_id = v.id
          LEFT JOIN atribuicao_cartelas ac ON a.id = ac.atribuicao_id
          WHERE a.sorteio_id = $1
          GROUP BY a.id, v.nome
          ORDER BY v.nome
        `, [data.sorteio_id]);
        return res.json({ data: result.rows });

      case 'createAtribuicao': {
        const atribResult = await client.query(`
          INSERT INTO atribuicoes (sorteio_id, vendedor_id)
          VALUES ($1, $2)
          RETURNING *
        `, [data.sorteio_id, data.vendedor_id]);
        
        const atribuicaoId = atribResult.rows[0].id;
        
        for (const cartela of data.cartelas) {
          await client.query(`
            INSERT INTO atribuicao_cartelas (atribuicao_id, numero_cartela, status, data_atribuicao)
            VALUES ($1, $2, 'ativa', NOW())
          `, [atribuicaoId, cartela]);
          
          await client.query(`
            UPDATE cartelas SET status = 'ativa', vendedor_id = $1 WHERE sorteio_id = $2 AND numero = $3
          `, [data.vendedor_id, data.sorteio_id, cartela]);
        }
        
        return res.json({ data: atribResult.rows });
      }

      case 'addCartelasToAtribuicao':
        for (const cartela of data.cartelas) {
          await client.query(`
            INSERT INTO atribuicao_cartelas (atribuicao_id, numero_cartela, status, data_atribuicao)
            VALUES ($1, $2, 'ativa', NOW())
          `, [data.atribuicao_id, cartela]);
          
          await client.query(`
            UPDATE cartelas SET status = 'ativa', vendedor_id = $1 WHERE sorteio_id = $2 AND numero = $3
          `, [data.vendedor_id, data.sorteio_id, cartela]);
        }
        return res.json({ data: [{ success: true }] });

      case 'removeCartelaFromAtribuicao':
        await client.query(`
          DELETE FROM atribuicao_cartelas WHERE atribuicao_id = $1 AND numero_cartela = $2
        `, [data.atribuicao_id, data.numero_cartela]);
        
        await client.query(`
          UPDATE cartelas SET status = 'disponivel', vendedor_id = NULL WHERE sorteio_id = $1 AND numero = $2
        `, [data.sorteio_id, data.numero_cartela]);
        
        return res.json({ data: [{ success: true }] });

      case 'updateCartelaStatusInAtribuicao':
        await client.query(`
          UPDATE atribuicao_cartelas 
          SET status = $3, data_devolucao = CASE WHEN $3 = 'devolvida' THEN NOW() ELSE NULL END
          WHERE atribuicao_id = $1 AND numero_cartela = $2
        `, [data.atribuicao_id, data.numero_cartela, data.status]);
        
        const cartelaStatus = data.status === 'devolvida' ? 'disponivel' : data.status;
        await client.query(`
          UPDATE cartelas SET status = $3, vendedor_id = CASE WHEN $3 = 'disponivel' THEN NULL ELSE vendedor_id END
          WHERE sorteio_id = $1 AND numero = $2
        `, [data.sorteio_id, data.numero_cartela, cartelaStatus]);
        
        return res.json({ data: [{ success: true }] });

      case 'transferirCartelas': {
        const cartelas = data.numeros_cartelas;
        if (!cartelas || cartelas.length === 0) {
          return res.status(400).json({ error: 'Nenhuma cartela selecionada para transferência' });
        }

        const destAtrib = await client.query(
          'SELECT id FROM atribuicoes WHERE sorteio_id = $1 AND vendedor_id = $2',
          [data.sorteio_id, data.vendedor_destino_id]
        );

        let destAtribId;
        if (destAtrib.rows.length > 0) {
          destAtribId = destAtrib.rows[0].id;
        } else {
          const newAtribResult = await client.query(
            'INSERT INTO atribuicoes (sorteio_id, vendedor_id) VALUES ($1, $2) RETURNING id',
            [data.sorteio_id, data.vendedor_destino_id]
          );
          destAtribId = newAtribResult.rows[0].id;
        }

        for (const numeroCartela of cartelas) {
          await client.query(
            'DELETE FROM atribuicao_cartelas WHERE atribuicao_id = $1 AND numero_cartela = $2',
            [data.atribuicao_origem_id, numeroCartela]
          );
          await client.query(
            'INSERT INTO atribuicao_cartelas (atribuicao_id, numero_cartela, status, data_atribuicao) VALUES ($1, $2, \'ativa\', NOW())',
            [destAtribId, numeroCartela]
          );
          await client.query(
            'UPDATE cartelas SET vendedor_id = $1 WHERE sorteio_id = $2 AND numero = $3',
            [data.vendedor_destino_id, data.sorteio_id, numeroCartela]
          );
        }

        const remainingInOrigin = await client.query(
          'SELECT COUNT(*) as count FROM atribuicao_cartelas WHERE atribuicao_id = $1',
          [data.atribuicao_origem_id]
        );
        
        if (parseInt(remainingInOrigin.rows[0].count) === 0) {
          await client.query('DELETE FROM atribuicoes WHERE id = $1', [data.atribuicao_origem_id]);
        }

        return res.json({ data: [{ success: true, count: cartelas.length }] });
      }

      case 'deleteAtribuicao': {
        const cartelasResult = await client.query(
          'SELECT numero_cartela FROM atribuicao_cartelas WHERE atribuicao_id = $1',
          [data.atribuicao_id]
        );
        
        for (const row of cartelasResult.rows) {
          await client.query(
            'UPDATE cartelas SET status = \'disponivel\', vendedor_id = NULL WHERE sorteio_id = $1 AND numero = $2',
            [data.sorteio_id, row.numero_cartela]
          );
        }
        
        await client.query('DELETE FROM atribuicao_cartelas WHERE atribuicao_id = $1', [data.atribuicao_id]);
        await client.query('DELETE FROM atribuicoes WHERE id = $1', [data.atribuicao_id]);
        
        return res.json({ data: [{ success: true }] });
      }

      // ================== VENDAS ==================
      case 'getVendas':
        result = await client.query(`
          SELECT ve.*, v.nome as vendedor_nome,
            COALESCE(json_agg(
              json_build_object(
                'forma_pagamento', p.forma_pagamento,
                'valor', p.valor
              ) ORDER BY p.created_at
            ) FILTER (WHERE p.id IS NOT NULL), '[]') as pagamentos
          FROM vendas ve
          LEFT JOIN vendedores v ON ve.vendedor_id = v.id
          LEFT JOIN pagamentos p ON ve.id = p.venda_id
          WHERE ve.sorteio_id = $1
          GROUP BY ve.id, v.nome
          ORDER BY ve.data_venda DESC
        `, [data.sorteio_id]);
        return res.json({ data: result.rows });

      case 'createVenda': {
        const vendaResult = await client.query(`
          INSERT INTO vendas (sorteio_id, vendedor_id, cliente_nome, cliente_telefone, numeros_cartelas, valor_total, valor_pago, status, data_venda)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *
        `, [data.sorteio_id, data.vendedor_id, data.cliente_nome, data.cliente_telefone, data.numeros_cartelas, data.valor_total, data.valor_pago, data.status]);
        
        const vendaId = vendaResult.rows[0].id;
        
        if (data.pagamentos && data.pagamentos.length > 0) {
          for (const pag of data.pagamentos) {
            await client.query(
              'INSERT INTO pagamentos (venda_id, forma_pagamento, valor, data_pagamento) VALUES ($1, $2, $3, NOW())',
              [vendaId, pag.forma_pagamento, pag.valor]
            );
          }
        }
        
        const numerosVenda = data.numeros_cartelas.split(',').map(n => parseInt(n.trim()));
        for (const numero of numerosVenda) {
          await client.query(
            'UPDATE cartelas SET status = \'vendida\' WHERE sorteio_id = $1 AND numero = $2',
            [data.sorteio_id, numero]
          );
          await client.query(`
            UPDATE atribuicao_cartelas SET status = 'vendida', venda_id = $1 
            WHERE numero_cartela = $2 AND atribuicao_id IN (
              SELECT id FROM atribuicoes WHERE sorteio_id = $3 AND vendedor_id = $4
            )
          `, [vendaId, numero, data.sorteio_id, data.vendedor_id]);
        }
        
        return res.json({ data: vendaResult.rows });
      }

      case 'updateVenda': {
        const oldVendaResult = await client.query(
          'SELECT numeros_cartelas, vendedor_id FROM vendas WHERE id = $1',
          [data.id]
        );
        const oldVenda = oldVendaResult.rows[0];
        const oldNumeros = oldVenda?.numeros_cartelas?.split(',').map(n => parseInt(n.trim())) || [];
        const newNumeros = data.numeros_cartelas.split(',').map(n => parseInt(n.trim()));
        
        const removedCartelas = oldNumeros.filter(n => !newNumeros.includes(n));
        for (const numero of removedCartelas) {
          await client.query(
            'UPDATE cartelas SET status = \'ativa\' WHERE sorteio_id = $1 AND numero = $2',
            [data.sorteio_id, numero]
          );
          await client.query(`
            UPDATE atribuicao_cartelas SET status = 'ativa', venda_id = NULL 
            WHERE numero_cartela = $1 AND atribuicao_id IN (
              SELECT id FROM atribuicoes WHERE sorteio_id = $2
            )
          `, [numero, data.sorteio_id]);
        }
        
        const addedCartelas = newNumeros.filter(n => !oldNumeros.includes(n));
        for (const numero of addedCartelas) {
          await client.query(
            'UPDATE cartelas SET status = \'vendida\' WHERE sorteio_id = $1 AND numero = $2',
            [data.sorteio_id, numero]
          );
          await client.query(`
            UPDATE atribuicao_cartelas SET status = 'vendida', venda_id = $1 
            WHERE numero_cartela = $2 AND atribuicao_id IN (
              SELECT id FROM atribuicoes WHERE sorteio_id = $3 AND vendedor_id = $4
            )
          `, [data.id, numero, data.sorteio_id, data.vendedor_id]);
        }
        
        await client.query('DELETE FROM pagamentos WHERE venda_id = $1', [data.id]);
        if (data.pagamentos && data.pagamentos.length > 0) {
          for (const pag of data.pagamentos) {
            await client.query(
              'INSERT INTO pagamentos (venda_id, forma_pagamento, valor, data_pagamento) VALUES ($1, $2, $3, NOW())',
              [data.id, pag.forma_pagamento, pag.valor]
            );
          }
        }
        
        result = await client.query(`
          UPDATE vendas 
          SET vendedor_id = $2, cliente_nome = $3, cliente_telefone = $4, numeros_cartelas = $5, 
              valor_total = $6, valor_pago = $7, status = $8, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.vendedor_id, data.cliente_nome, data.cliente_telefone, data.numeros_cartelas, data.valor_total, data.valor_pago, data.status]);
        return res.json({ data: result.rows });
      }

      case 'deleteVenda': {
        const vendaToDeleteResult = await client.query(
          'SELECT numeros_cartelas, sorteio_id, vendedor_id FROM vendas WHERE id = $1',
          [data.id]
        );
        const vendaToDelete = vendaToDeleteResult.rows[0];
        
        if (vendaToDelete) {
          const numerosToReturn = vendaToDelete.numeros_cartelas.split(',').map(n => parseInt(n.trim()));
          
          for (const numero of numerosToReturn) {
            await client.query(
              'UPDATE cartelas SET status = \'ativa\' WHERE sorteio_id = $1 AND numero = $2',
              [vendaToDelete.sorteio_id, numero]
            );
            await client.query(`
              UPDATE atribuicao_cartelas SET status = 'ativa', venda_id = NULL 
              WHERE numero_cartela = $1 AND atribuicao_id IN (
                SELECT id FROM atribuicoes WHERE sorteio_id = $2
              )
            `, [numero, vendaToDelete.sorteio_id]);
          }
        }
        
        await client.query('DELETE FROM pagamentos WHERE venda_id = $1', [data.id]);
        await client.query('DELETE FROM vendas WHERE id = $1', [data.id]);
        
        return res.json({ data: [{ success: true }] });
      }

      case 'addPagamento': {
        await client.query(`
          INSERT INTO pagamentos (venda_id, forma_pagamento, valor, observacao, data_pagamento)
          VALUES ($1, $2, $3, $4, NOW())
        `, [data.venda_id, data.forma_pagamento, data.valor, data.observacao]);
        
        const totalPaidResult = await client.query(
          'SELECT COALESCE(SUM(valor), 0) as total_pago FROM pagamentos WHERE venda_id = $1',
          [data.venda_id]
        );
        const totalPaid = parseFloat(totalPaidResult.rows[0].total_pago) || 0;
        
        const vendaInfoResult = await client.query(
          'SELECT valor_total FROM vendas WHERE id = $1',
          [data.venda_id]
        );
        const valorTotal = parseFloat(vendaInfoResult.rows[0].valor_total) || 0;
        
        const newStatus = totalPaid >= valorTotal ? 'concluida' : 'pendente';
        
        await client.query(
          'UPDATE vendas SET valor_pago = $2, status = $3, updated_at = NOW() WHERE id = $1',
          [data.venda_id, totalPaid, newStatus]
        );
        
        return res.json({ data: [{ success: true, total_pago: totalPaid, status: newStatus }] });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: error.message || 'Database error occurred' });
  } finally {
    client.release();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Bingo Backend API running on port ${PORT}`);
  console.log(`Basic Auth: ${BASIC_AUTH_USER ? 'ENABLED' : 'DISABLED'}`);
});
