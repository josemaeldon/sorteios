const express = require('express');
const cors = require('cors');
const DatabaseAdapter = require('./db-adapter');
const crypto = require('crypto');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Basic-Auth'],
}));

// Returns a date one month after `from`, clamped to the last day of the target month.
function nextMonthSameDay(from) {
  const day = from.getDate();
  const result = new Date(from);
  result.setMonth(result.getMonth() + 1);
  // If month overflowed (e.g. Jan 31 → Mar 2), clamp to last day of intended month.
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

// Stripe webhook must receive raw body — register before express.json()
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const configClient = await dbAdapter.getConnection();
    let webhookSecret = '';
    let stripeSecretKey = '';
    try {
      const cfgResult = await configClient.query('SELECT chave, valor FROM configuracoes WHERE chave IN ($1, $2)', ['stripe_secret_key', 'stripe_webhook_secret']);
      cfgResult.rows.forEach(r => {
        if (r.chave === 'stripe_secret_key') stripeSecretKey = r.valor || '';
        if (r.chave === 'stripe_webhook_secret') webhookSecret = r.valor || '';
      });
    } finally {
      configClient.release();
    }

    if (!stripeSecretKey) {
      return res.status(400).send('Stripe not configured');
    }

    const stripe = Stripe(stripeSecretKey);

    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      event = JSON.parse(req.body.toString());
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata && session.metadata.user_id;
      const planoId = session.metadata && session.metadata.plano_id;

      if (userId && planoId) {
        const updateClient = await dbAdapter.getConnection();
        try {
          const now = new Date();
          const vencimento = nextMonthSameDay(now);
          await updateClient.query(
            'UPDATE usuarios SET plano_id = $1, plano_inicio = $2, plano_vencimento = $3, updated_at = NOW() WHERE id = $4',
            [planoId, now, vencimento, userId]
          );
        } finally {
          updateClient.release();
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(500).send('Internal error');
  }
});

app.use(express.json({ limit: '10mb' }));

// Load database configuration from environment variables
const dbConfig = {
  type: process.env.DB_TYPE || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || (process.env.DB_TYPE === 'mysql' ? '3306' : '5432')),
  database: process.env.DB_NAME || 'bingo',
  user: process.env.DB_USER || (process.env.DB_TYPE === 'mysql' ? 'root' : 'postgres'),
  password: process.env.DB_PASSWORD || '',
};

// Initialize database adapter
const dbAdapter = new DatabaseAdapter(dbConfig);
dbAdapter.connect();
console.log(`Database adapter initialized for ${dbConfig.type}`);

// Auto-create sorteio_compartilhado table for existing deployments
async function initSchema() {
  try {
    const client = await dbAdapter.getConnection();
    try {
      if (dbConfig.type === 'mysql') {
        await client.query(`
          CREATE TABLE IF NOT EXISTS sorteio_compartilhado (
            id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            sorteio_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE KEY uq_sorteio_user (sorteio_id, user_id)
          )
        `);
        // Add numeros_grade column if missing (MySQL)
        try {
          await client.query(`ALTER TABLE cartelas ADD COLUMN numeros_grade JSON`);
        } catch (e) {
          if (!e.message || !e.message.includes('Duplicate column')) {
            console.warn('numeros_grade column may already exist or could not be added:', e.message);
          }
        }
        // Create bingo_card_sets table (MySQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS bingo_card_sets (
            id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            sorteio_id CHAR(36) NOT NULL,
            nome VARCHAR(255) NOT NULL,
            layout_data LONGTEXT NOT NULL,
            cards_data LONGTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
          )
        `);
        // Create cartelas_validadas table (MySQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS cartelas_validadas (
            id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            sorteio_id CHAR(36) NOT NULL,
            numero INT NOT NULL,
            comprador_nome VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            UNIQUE KEY uq_validada_sorteio_numero (sorteio_id, numero)
          )
        `);
        // Create planos table (MySQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS planos (
            id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            nome VARCHAR(255) NOT NULL,
            valor DECIMAL(10,2) NOT NULL DEFAULT 0,
            descricao TEXT,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
          )
        `);
        // Create configuracoes table (MySQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS configuracoes (
            chave VARCHAR(100) PRIMARY KEY,
            valor TEXT,
            updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
          )
        `);
        // Add plano_id and gratuidade_vitalicia to usuarios (MySQL)
        try {
          await client.query(`ALTER TABLE usuarios ADD COLUMN plano_id CHAR(36)`);
        } catch (e) {
          if (!e.message || !e.message.includes('Duplicate column')) {
            console.warn('Could not add plano_id column (unexpected error):', e.message);
          }
          // 'Duplicate column' means it already exists — silently continue
        }
        try {
          await client.query(`ALTER TABLE usuarios ADD COLUMN gratuidade_vitalicia TINYINT(1) NOT NULL DEFAULT 0`);
        } catch (e) {
          if (!e.message || !e.message.includes('Duplicate column')) {
            console.warn('Could not add gratuidade_vitalicia column (unexpected error):', e.message);
          }
          // 'Duplicate column' means it already exists — silently continue
        }
        try {
          await client.query(`ALTER TABLE usuarios ADD COLUMN plano_inicio TIMESTAMP`);
        } catch (e) {
          if (!e.message || !e.message.includes('Duplicate column')) {
            console.warn('Could not add plano_inicio column (unexpected error):', e.message);
          }
        }
        try {
          await client.query(`ALTER TABLE usuarios ADD COLUMN plano_vencimento TIMESTAMP`);
        } catch (e) {
          if (!e.message || !e.message.includes('Duplicate column')) {
            console.warn('Could not add plano_vencimento column (unexpected error):', e.message);
          }
        }
        try {
          await client.query(`ALTER TABLE planos ADD COLUMN stripe_price_id VARCHAR(255)`);
        } catch (e) {
          if (!e.message || !e.message.includes('Duplicate column')) {
            console.warn('Could not add stripe_price_id column (unexpected error):', e.message);
          }
        }
      } else {
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.sorteio_compartilhado (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            UNIQUE(sorteio_id, user_id)
          )
        `);
        // Add numeros_grade column if missing (PostgreSQL)
        await client.query(`
          ALTER TABLE cartelas ADD COLUMN IF NOT EXISTS numeros_grade JSONB
        `);
        // Create bingo_card_sets table (PostgreSQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.bingo_card_sets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
            nome VARCHAR(255) NOT NULL,
            layout_data TEXT NOT NULL,
            cards_data TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
          )
        `);
        // Create cartelas_validadas table (PostgreSQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.cartelas_validadas (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sorteio_id UUID NOT NULL REFERENCES public.sorteios(id) ON DELETE CASCADE,
            numero INT NOT NULL,
            comprador_nome VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            UNIQUE(sorteio_id, numero)
          )
        `);
        // Create planos table (PostgreSQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.planos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nome VARCHAR(255) NOT NULL,
            valor NUMERIC(10,2) NOT NULL DEFAULT 0,
            descricao TEXT,
            ativo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
          )
        `);
        // Create configuracoes table (PostgreSQL)
        await client.query(`
          CREATE TABLE IF NOT EXISTS public.configuracoes (
            chave VARCHAR(100) PRIMARY KEY,
            valor TEXT,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
          )
        `);
        // Add plano_id and gratuidade_vitalicia to usuarios (PostgreSQL)
        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL`);
        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS gratuidade_vitalicia BOOLEAN NOT NULL DEFAULT false`);
        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plano_inicio TIMESTAMP WITH TIME ZONE`);
        await client.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plano_vencimento TIMESTAMP WITH TIME ZONE`);
        await client.query(`ALTER TABLE planos ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255)`);
      }
      console.log('Schema initialized: sorteio_compartilhado table ready');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Schema init error:', err.message);
  }
}
initSchema();

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
  const publicActions = ['checkFirstAccess', 'setupAdmin', 'login'];
  const adminActions = ['getUsers', 'createUser', 'updateUser', 'deleteUser', 'getAllSorteiosAdmin', 'assignSorteioToUser', 'removeUserFromSorteio', 'getSorteioUsers', 'getPlanos', 'createPlano', 'updatePlano', 'deletePlano', 'assignUserPlan', 'grantLifetimeAccess', 'getConfiguracoes', 'updateConfiguracoes'];

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
          SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, senha_hash, created_at, plano_id, gratuidade_vitalicia, plano_inicio, plano_vencimento
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
          SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at, updated_at, plano_id, gratuidade_vitalicia, plano_inicio, plano_vencimento
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

      case 'getAllSorteiosAdmin':
        result = await client.query(`
          SELECT s.*, u.nome as owner_nome, u.email as owner_email
          FROM sorteios s
          JOIN usuarios u ON s.user_id = u.id
          ORDER BY s.created_at DESC
        `);
        return res.json({ data: result.rows });

      case 'getSorteioUsers': {
        const sorteioRow = await client.query(
          'SELECT user_id FROM sorteios WHERE id = $1', [data.sorteio_id]
        );
        const ownerId = sorteioRow.rows[0]?.user_id;
        const sharedResult = await client.query(
          'SELECT user_id FROM sorteio_compartilhado WHERE sorteio_id = $1', [data.sorteio_id]
        );
        const sharedUserIds = sharedResult.rows.map(r => r.user_id);
        const allIds = ownerId ? [ownerId, ...sharedUserIds] : sharedUserIds;
        if (allIds.length === 0) return res.json({ data: [], owner_id: ownerId || '' });
        const placeholders = allIds.map((_, i) => `$${i + 1}`).join(', ');
        const usersResult = await client.query(
          `SELECT id, nome, email, role FROM usuarios WHERE id IN (${placeholders})`, allIds
        );
        return res.json({ data: usersResult.rows, owner_id: ownerId });
      }

      case 'assignSorteioToUser': {
        await client.query(`
          INSERT INTO sorteio_compartilhado (sorteio_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (sorteio_id, user_id) DO NOTHING
        `, [data.sorteio_id, data.user_id]);
        return res.json({ success: true });
      }

      case 'removeUserFromSorteio':
        await client.query(
          'DELETE FROM sorteio_compartilhado WHERE sorteio_id = $1 AND user_id = $2',
          [data.sorteio_id, data.user_id]
        );
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
          `SELECT DISTINCT s.* FROM sorteios s
           LEFT JOIN sorteio_compartilhado sc ON sc.sorteio_id = s.id
           WHERE s.user_id = $1 OR sc.user_id = $1
           ORDER BY s.created_at DESC`,
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
      case 'getCartelas': {
        result = await client.query(
          'SELECT numero, status, vendedor_id, numeros_grade FROM cartelas WHERE sorteio_id = $1 ORDER BY numero',
          [data.sorteio_id]
        );
        // Normalize numeros_grade to number[][] format
        const rows = result.rows.map(row => {
          if (!row.numeros_grade) return row;
          let raw;
          try {
            raw = Array.isArray(row.numeros_grade) ? row.numeros_grade : JSON.parse(row.numeros_grade);
          } catch {
            return row;
          }
          // Old format: flat number[] => wrap as [flat] (single prize)
          if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
            return { ...row, numeros_grade: [raw] };
          }
          return { ...row, numeros_grade: raw };
        });
        return res.json({ data: rows });
      }

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

      case 'salvarNumerosCartelas': {
        // data.sorteio_id, data.cartelas: [{numero, numeros_grade: number[][]}]
        // numeros_grade is an array of flat 25-number arrays (one per prize)
        const cartelasGrade = data.cartelas || [];
        for (const c of cartelasGrade) {
          await client.query(
            `UPDATE cartelas SET numeros_grade = $1, updated_at = NOW() WHERE sorteio_id = $2 AND numero = $3`,
            [JSON.stringify(c.numeros_grade), data.sorteio_id, c.numero]
          );
        }
        return res.json({ data: [{ success: true, saved: cartelasGrade.length }] });
      }

      case 'deleteCartela': {
        // Remove from atribuicao_cartelas first to avoid orphaned records
        await client.query(
          `DELETE FROM atribuicao_cartelas WHERE atribuicao_id IN (
             SELECT id FROM atribuicoes WHERE sorteio_id = $1
           ) AND numero_cartela = $2`,
          [data.sorteio_id, data.numero]
        );
        await client.query(
          'DELETE FROM cartelas WHERE sorteio_id = $1 AND numero = $2',
          [data.sorteio_id, data.numero]
        );
        return res.json({ data: [{ success: true }] });
      }

      case 'createCartela': {
        const maxResult = await client.query(
          'SELECT COALESCE(MAX(numero), 0) as max_num FROM cartelas WHERE sorteio_id = $1',
          [data.sorteio_id]
        );
        const nextNum = (maxResult.rows[0]?.max_num ?? 0) + 1;
        const numerosGradeJson = data.numeros_grade ? JSON.stringify(data.numeros_grade) : null;
        await client.query(
          'INSERT INTO cartelas (sorteio_id, numero, status, numeros_grade) VALUES ($1, $2, $3, $4)',
          [data.sorteio_id, nextNum, 'disponivel', numerosGradeJson]
        );
        return res.json({ data: [{ success: true, numero: nextNum }] });
      }

      // ================== CARTELAS VALIDADAS ==================
      case 'getCartelasValidadas': {
        result = await client.query(
          'SELECT id, numero, comprador_nome, created_at FROM cartelas_validadas WHERE sorteio_id = $1 ORDER BY created_at ASC',
          [data.sorteio_id]
        );
        return res.json({ data: result.rows });
      }

      case 'validarCartela': {
        // data.sorteio_id, data.numero, data.comprador_nome (optional)
        const numero = Number(data.numero);
        if (!numero || numero < 1) {
          return res.status(400).json({ error: 'Número de cartela inválido' });
        }
        // Verify cartela exists for this sorteio
        const cartelaCheck = await client.query(
          'SELECT numero FROM cartelas WHERE sorteio_id = $1 AND numero = $2',
          [data.sorteio_id, numero]
        );
        if (cartelaCheck.rows.length === 0) {
          return res.status(404).json({ error: `Cartela ${numero} não encontrada neste sorteio` });
        }
        // Upsert validation record
        if (dbConfig.type === 'mysql') {
          await client.query(
            `INSERT INTO cartelas_validadas (id, sorteio_id, numero, comprador_nome) VALUES (UUID(), $1, $2, $3)
             ON DUPLICATE KEY UPDATE comprador_nome = VALUES(comprador_nome)`,
            [data.sorteio_id, numero, data.comprador_nome || null]
          );
        } else {
          await client.query(
            `INSERT INTO cartelas_validadas (sorteio_id, numero, comprador_nome)
             VALUES ($1, $2, $3)
             ON CONFLICT (sorteio_id, numero) DO UPDATE SET comprador_nome = EXCLUDED.comprador_nome`,
            [data.sorteio_id, numero, data.comprador_nome || null]
          );
        }
        return res.json({ data: [{ success: true, numero }] });
      }

      case 'removerValidacaoCartela': {
        // data.sorteio_id, data.numero
        await client.query(
          'DELETE FROM cartelas_validadas WHERE sorteio_id = $1 AND numero = $2',
          [data.sorteio_id, Number(data.numero)]
        );
        return res.json({ data: [{ success: true }] });
      }

      case 'validarCartelas': {
        // data.sorteio_id, data.numeros: number[], data.comprador_nome (optional)
        const numeros = (data.numeros || []).map(Number).filter(n => n > 0);
        if (numeros.length === 0) {
          return res.status(400).json({ error: 'Nenhum número de cartela válido fornecido' });
        }
        // Verify all cartelas exist for this sorteio
        const placeholders = numeros.map((_, i) => `$${i + 2}`).join(', ');
        const existCheck = await client.query(
          `SELECT numero FROM cartelas WHERE sorteio_id = $1 AND numero IN (${placeholders})`,
          [data.sorteio_id, ...numeros]
        );
        const existentes = new Set(existCheck.rows.map(r => r.numero));
        const naoEncontradas = numeros.filter(n => !existentes.has(n));
        if (naoEncontradas.length > 0) {
          return res.status(404).json({ error: `Cartelas não encontradas neste sorteio: ${naoEncontradas.join(', ')}` });
        }
        // Upsert all validations
        for (const num of numeros) {
          if (dbConfig.type === 'mysql') {
            await client.query(
              `INSERT INTO cartelas_validadas (id, sorteio_id, numero, comprador_nome) VALUES (UUID(), $1, $2, $3)
               ON DUPLICATE KEY UPDATE comprador_nome = VALUES(comprador_nome)`,
              [data.sorteio_id, num, data.comprador_nome || null]
            );
          } else {
            await client.query(
              `INSERT INTO cartelas_validadas (sorteio_id, numero, comprador_nome)
               VALUES ($1, $2, $3)
               ON CONFLICT (sorteio_id, numero) DO UPDATE SET comprador_nome = EXCLUDED.comprador_nome`,
              [data.sorteio_id, num, data.comprador_nome || null]
            );
          }
        }
        return res.json({ data: [{ success: true, count: numeros.length }] });
      }

      case 'removerValidacaoLote': {
        // data.sorteio_id, data.numeros: number[]
        const numeros = (data.numeros || []).map(Number).filter(n => n > 0);
        if (numeros.length === 0) {
          return res.json({ data: [{ success: true }] });
        }
        const placeholders = numeros.map((_, i) => `$${i + 2}`).join(', ');
        await client.query(
          `DELETE FROM cartelas_validadas WHERE sorteio_id = $1 AND numero IN (${placeholders})`,
          [data.sorteio_id, ...numeros]
        );
        return res.json({ data: [{ success: true, count: numeros.length }] });
      }

      case 'verificarVencedor': {
        // data.sorteio_id, data.numeros_sorteados: number[]
        // Only considers validated cartelas (cartelas_validadas table)
        const numerosSet = new Set((data.numeros_sorteados || []).map(Number));
        const cartelasResult = await client.query(
          `SELECT c.numero, c.numeros_grade
           FROM cartelas c
           INNER JOIN cartelas_validadas cv ON cv.sorteio_id = c.sorteio_id AND cv.numero = c.numero
           WHERE c.sorteio_id = $1 AND c.numeros_grade IS NOT NULL
           ORDER BY c.numero`,
          [data.sorteio_id]
        );
        const vencedoras = [];
        for (const row of cartelasResult.rows) {
          let raw;
          try {
            raw = Array.isArray(row.numeros_grade) ? row.numeros_grade : JSON.parse(row.numeros_grade);
          } catch {
            continue;
          }
          // Normalize to number[][] - use first prize grid for winner check
          let grade;
          if (!Array.isArray(raw) || raw.length === 0) continue;
          if (typeof raw[0] === 'number') {
            grade = raw; // old flat format
          } else {
            grade = Array.isArray(raw[0]) ? raw[0] : []; // new format: take first prize grid
          }
          const required = grade.filter((n) => n !== 0);
          if (required.length > 0 && required.every((n) => numerosSet.has(Number(n)))) {
            vencedoras.push(row.numero);
          }
        }
        return res.json({ data: vencedoras });
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

      // ================== BINGO CARD SETS (LAYOUTS) ==================
      case 'getCartelaLayouts':
        result = await client.query(
          'SELECT id, sorteio_id, nome, layout_data, cards_data, created_at, updated_at FROM bingo_card_sets WHERE sorteio_id = $1 ORDER BY created_at DESC',
          [data.sorteio_id]
        );
        return res.json({ data: result.rows });

      case 'saveCartelaLayout': {
        result = await client.query(
          'INSERT INTO bingo_card_sets (sorteio_id, nome, layout_data, cards_data) VALUES ($1, $2, $3, $4) RETURNING *',
          [data.sorteio_id, data.nome, data.layout_data, data.cards_data]
        );
        return res.json({ data: result.rows[0] });
      }

      case 'updateCartelaLayout': {
        result = await client.query(
          'UPDATE bingo_card_sets SET nome = $2, layout_data = $3, cards_data = $4, updated_at = NOW() WHERE id = $1 RETURNING *',
          [data.id, data.nome, data.layout_data, data.cards_data]
        );
        return res.json({ data: result.rows[0] });
      }

      case 'deleteCartelaLayout':
        await client.query('DELETE FROM bingo_card_sets WHERE id = $1', [data.id]);
        return res.json({ data: [{ success: true }] });

      // ================== PLANOS ==================
      case 'getPublicPlanos':
        result = await client.query('SELECT id, nome, valor, descricao, ativo, stripe_price_id FROM planos WHERE ativo = true ORDER BY valor ASC');
        return res.json({ data: result.rows });

      case 'getPlanos':
        result = await client.query('SELECT * FROM planos ORDER BY valor ASC');
        return res.json({ data: result.rows });

      case 'createPlano': {
        result = await client.query(
          `INSERT INTO planos (nome, valor, descricao, stripe_price_id) VALUES ($1, $2, $3, $4) RETURNING *`,
          [data.nome, data.valor || 0, data.descricao || null, data.stripe_price_id || null]
        );
        return res.json({ data: result.rows[0] });
      }

      case 'updatePlano': {
        result = await client.query(
          `UPDATE planos SET nome = $2, valor = $3, descricao = $4, stripe_price_id = $5, updated_at = NOW() WHERE id = $1 RETURNING *`,
          [data.id, data.nome, data.valor || 0, data.descricao || null, data.stripe_price_id || null]
        );
        return res.json({ data: result.rows[0] });
      }

      case 'deletePlano':
        await client.query('DELETE FROM planos WHERE id = $1', [data.id]);
        return res.json({ success: true });

      case 'assignUserPlan': {
        const planoId = data.plano_id || null;
        if (planoId) {
          const now = new Date();
          const vencimento = nextMonthSameDay(now);
          await client.query(
            'UPDATE usuarios SET plano_id = $2, plano_inicio = $3, plano_vencimento = $4, updated_at = NOW() WHERE id = $1',
            [data.user_id, planoId, now, vencimento]
          );
        } else {
          await client.query(
            'UPDATE usuarios SET plano_id = NULL, plano_inicio = NULL, plano_vencimento = NULL, updated_at = NOW() WHERE id = $1',
            [data.user_id]
          );
        }
        return res.json({ success: true });
      }

      case 'createStripeCheckout': {
        const cfgResult = await client.query('SELECT chave, valor FROM configuracoes WHERE chave IN ($1, $2)', ['stripe_secret_key', 'stripe_webhook_secret']);
        let stripeSecretKey = '';
        cfgResult.rows.forEach(r => {
          if (r.chave === 'stripe_secret_key') stripeSecretKey = r.valor || '';
        });
        if (!stripeSecretKey) {
          return res.status(400).json({ error: 'Stripe não configurado. Contate o administrador.' });
        }
        const planoResult = await client.query('SELECT id, nome, valor, stripe_price_id FROM planos WHERE id = $1 AND ativo = true', [data.plano_id]);
        if (planoResult.rows.length === 0) {
          return res.status(404).json({ error: 'Plano não encontrado.' });
        }
        const plano = planoResult.rows[0];
        const stripe = Stripe(stripeSecretKey);
        const baseUrl = (process.env.APP_URL || '').replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;

        let sessionParams = {
          mode: 'payment',
          success_url: `${baseUrl}/`,
          cancel_url: `${baseUrl}/planos`,
          metadata: { user_id: data.authenticated_user_id, plano_id: plano.id },
          client_reference_id: data.authenticated_user_id,
        };

        if (plano.stripe_price_id) {
          sessionParams.line_items = [{ price: plano.stripe_price_id, quantity: 1 }];
        } else {
          const valorCentavos = Math.round(Number(plano.valor) * 100);
          sessionParams.line_items = [{
            price_data: {
              currency: 'brl',
              product_data: { name: plano.nome },
              unit_amount: valorCentavos,
            },
            quantity: 1,
          }];
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        return res.json({ url: session.url });
      }

      case 'grantLifetimeAccess':
        await client.query(
          'UPDATE usuarios SET gratuidade_vitalicia = $2, updated_at = NOW() WHERE id = $1',
          [data.user_id, data.gratuidade_vitalicia ? true : false]
        );
        return res.json({ success: true });

      // ================== CONFIGURACOES ==================
      case 'getConfiguracoes': {
        result = await client.query('SELECT chave, valor FROM configuracoes');
        const config = {};
        result.rows.forEach(row => { config[row.chave] = row.valor; });
        return res.json({ data: config });
      }

      case 'updateConfiguracoes': {
        const entries = Object.entries(data.config || {});
        for (const [chave, valor] of entries) {
          if (dbConfig.type === 'mysql') {
            await client.query(
              `INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()`,
              [chave, valor]
            );
          } else {
            await client.query(
              `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
              [chave, valor]
            );
          }
        }
        return res.json({ success: true });
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
