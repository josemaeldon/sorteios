import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as base64Encode, decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostgresConfig {
  hostname: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const getDbConfig = (): PostgresConfig => ({
  hostname: Deno.env.get('POSTGRES_HOST') || '',
  port: parseInt(Deno.env.get('POSTGRES_PORT') || '5432'),
  database: Deno.env.get('POSTGRES_DB') || '',
  user: Deno.env.get('POSTGRES_USER') || '',
  password: Deno.env.get('POSTGRES_PASSWORD') || '',
});

// JWT Secret - use a strong secret from environment or generate one
const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'bingo_jwt_secret_2024_secure';
const JWT_EXPIRY_HOURS = 24;

// Simple hash function for passwords
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'bingo_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// JWT Functions
function base64UrlEncode(data: Uint8Array): string {
  // Convert Uint8Array to string for btoa
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createJwt(payload: { user_id: string; role: string; email: string }): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (JWT_EXPIRY_HOURS * 60 * 60),
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));

  const signatureInput = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function verifyJwt(token: string): Promise<{ user_id: string; role: string; email: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();

    // Verify signature
    const signatureInput = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureBytes = base64UrlDecode(signatureB64);
    // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
    const signatureBuffer = new ArrayBuffer(signatureBytes.length);
    new Uint8Array(signatureBuffer).set(signatureBytes);
    
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, encoder.encode(signatureInput));

    if (!isValid) return null;

    // Decode payload
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadB64)));

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

// Extract and verify token from request
async function getAuthenticatedUser(req: Request): Promise<{ user_id: string; role: string; email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return await verifyJwt(token);
}

// Actions that don't require authentication
const publicActions = ['checkFirstAccess', 'setupAdmin', 'login'];

// Actions that require admin role
const adminActions = ['getUsers', 'createUser', 'updateUser', 'deleteUser'];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;

  try {
    const config = getDbConfig();
    
    // Validate configuration
    if (!config.hostname || !config.database || !config.user || !config.password) {
      console.error('Missing database configuration');
      return new Response(
        JSON.stringify({ error: 'Database configuration is incomplete' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clone request for auth check (body can only be read once)
    const bodyText = await req.text();
    const { action, data } = JSON.parse(bodyText);
    console.log(`Executing action: ${action}`);

    // Check authentication for protected actions
    if (!publicActions.includes(action)) {
      const authUser = await getAuthenticatedUser(req);
      
      if (!authUser) {
        console.log(`Unauthorized access attempt for action: ${action}`);
        return new Response(
          JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role for admin actions
      if (adminActions.includes(action) && authUser.role !== 'admin') {
        console.log(`Admin access denied for user: ${authUser.email}`);
        return new Response(
          JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // IMPORTANT: Use authenticated user_id instead of client-supplied
      // This prevents user_id spoofing attacks
      data.authenticated_user_id = authUser.user_id;
      data.authenticated_role = authUser.role;
    }

    client = new Client(config);
    await client.connect();

    let result;

    switch (action) {
      // ================== AUTH ==================
      case 'checkFirstAccess':
        result = await client.queryObject(`SELECT COUNT(*) as count FROM usuarios`);
        const count = parseInt((result.rows[0] as any).count) || 0;
        return new Response(
          JSON.stringify({ isFirstAccess: count === 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'setupAdmin':
        // Check if any user exists
        const existingCheck = await client.queryObject(`SELECT COUNT(*) as count FROM usuarios`);
        if (parseInt((existingCheck.rows[0] as any).count) > 0) {
          return new Response(
            JSON.stringify({ error: 'Administrador já existe' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const adminHash = await hashPassword(data.senha);
        const adminResult = await client.queryObject(`
          INSERT INTO usuarios (email, senha_hash, nome, role, ativo, titulo_sistema)
          VALUES ($1, $2, $3, 'admin', true, $4)
          RETURNING id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at
        `, [data.email, adminHash, data.nome, data.titulo_sistema || 'Sorteios']);
        
        return new Response(
          JSON.stringify({ user: adminResult.rows[0] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'login':
        const userResult = await client.queryObject(`
          SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, senha_hash, created_at 
          FROM usuarios WHERE email = $1
        `, [data.email]);
        
        if (userResult.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Credenciais inválidas' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const foundUser = userResult.rows[0] as any;
        const passwordValid = await verifyPassword(data.senha, foundUser.senha_hash);
        
        if (!passwordValid) {
          return new Response(
            JSON.stringify({ error: 'Credenciais inválidas' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!foundUser.ativo) {
          return new Response(
            JSON.stringify({ error: 'Usuário inativo. Contate o administrador.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Generate JWT token
        const token = await createJwt({
          user_id: foundUser.id,
          role: foundUser.role,
          email: foundUser.email
        });
        
        // Remove senha_hash from response
        delete foundUser.senha_hash;
        
        console.log(`User ${foundUser.email} logged in successfully`);
        
        return new Response(
          JSON.stringify({ user: foundUser, token }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'getUsers':
        result = await client.queryObject(`
          SELECT id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at, updated_at 
          FROM usuarios ORDER BY nome
        `);
        return new Response(
          JSON.stringify({ users: result.rows }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'createUser':
        const newUserHash = await hashPassword(data.senha);
        const newUserResult = await client.queryObject(`
          INSERT INTO usuarios (email, senha_hash, nome, role, ativo, titulo_sistema, avatar_url)
          VALUES ($1, $2, $3, $4, true, $5, $6)
          RETURNING id, email, nome, role, ativo, titulo_sistema, avatar_url, created_at
        `, [data.email, newUserHash, data.nome, data.role, data.titulo_sistema || 'Sorteios', data.avatar_url || null]);
        
        return new Response(
          JSON.stringify({ user: newUserResult.rows[0] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'updateUser':
        if (data.senha) {
          const updateHash = await hashPassword(data.senha);
          await client.queryObject(`
            UPDATE usuarios SET email = $2, nome = $3, role = $4, senha_hash = $5, titulo_sistema = $6, updated_at = NOW()
            WHERE id = $1
          `, [data.id, data.email, data.nome, data.role, updateHash, data.titulo_sistema || 'Sorteios']);
        } else {
          await client.queryObject(`
            UPDATE usuarios SET email = $2, nome = $3, role = $4, titulo_sistema = $5, updated_at = NOW()
            WHERE id = $1
          `, [data.id, data.email, data.nome, data.role, data.titulo_sistema || 'Sorteios']);
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'deleteUser':
        await client.queryObject(`DELETE FROM usuarios WHERE id = $1`, [data.id]);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'updateProfile':
        // Use authenticated user_id - users can only update their own profile
        const profileUserId = data.authenticated_user_id;
        
        // If updating password, verify current password first
        if (data.nova_senha) {
          const currentUserResult = await client.queryObject(`
            SELECT senha_hash FROM usuarios WHERE id = $1
          `, [profileUserId]);
          
          if (currentUserResult.rows.length === 0) {
            return new Response(
              JSON.stringify({ error: 'Usuário não encontrado' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          const currentUser = currentUserResult.rows[0] as any;
          const senhaValida = await verifyPassword(data.senha_atual, currentUser.senha_hash);
          
          if (!senhaValida) {
            return new Response(
              JSON.stringify({ error: 'Senha atual incorreta' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          const newHash = await hashPassword(data.nova_senha);
          await client.queryObject(`
            UPDATE usuarios SET nome = $2, email = $3, titulo_sistema = $4, avatar_url = $5, senha_hash = $6, updated_at = NOW()
            WHERE id = $1
          `, [profileUserId, data.nome, data.email, data.titulo_sistema, data.avatar_url || null, newHash]);
        } else {
          await client.queryObject(`
            UPDATE usuarios SET nome = $2, email = $3, titulo_sistema = $4, avatar_url = $5, updated_at = NOW()
            WHERE id = $1
          `, [profileUserId, data.nome, data.email, data.titulo_sistema, data.avatar_url || null]);
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      // ================== SORTEIOS (filtered by authenticated user) ==================
      case 'getSorteios':
        // Use authenticated user_id instead of client-supplied
        result = await client.queryObject(`
          SELECT * FROM sorteios WHERE user_id = $1 ORDER BY created_at DESC
        `, [data.authenticated_user_id]);
        break;

      case 'createSorteio': {
        // premios is an array, premio is the first item for backwards compatibility
        const premiosCreate = data.premios || (data.premio ? [data.premio] : []);
        const premioCreate = premiosCreate[0] || '';
        
        // Use authenticated user_id instead of client-supplied
        result = await client.queryObject(`
          INSERT INTO sorteios (user_id, nome, data_sorteio, premio, premios, valor_cartela, quantidade_cartelas, status)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
          RETURNING *
        `, [data.authenticated_user_id, data.nome, data.data_sorteio, premioCreate, JSON.stringify(premiosCreate), data.valor_cartela, data.quantidade_cartelas, data.status]);
        
        // Generate cartelas automatically (batched)
        const newSorteioId = (result.rows[0] as any).id;
        const quantidadeCartelas = Number(data.quantidade_cartelas || 0);
        console.log(`Generating ${quantidadeCartelas} cartelas for sorteio ${newSorteioId}`);

        const batchSize = 500;
        for (let batch = 0; batch < Math.ceil(quantidadeCartelas / batchSize); batch++) {
          const startNum = batch * batchSize + 1;
          const endNum = Math.min((batch + 1) * batchSize, quantidadeCartelas);

          const values: string[] = [];
          const params: any[] = [newSorteioId];
          let paramIndex = 2;

          for (let i = startNum; i <= endNum; i++) {
            values.push(`($1, $${paramIndex}, 'disponivel')`);
            params.push(i);
            paramIndex++;
          }

          if (values.length > 0) {
            await client.queryObject(
              `INSERT INTO cartelas (sorteio_id, numero, status) VALUES ${values.join(', ')}`,
              params
            );
          }
        }

        console.log(`Generated ${quantidadeCartelas} cartelas successfully`);
        break;
      }

      case 'updateSorteio':
        // premios is an array, premio is the first item for backwards compatibility
        const premiosUpdate = data.premios || (data.premio ? [data.premio] : []);
        const premioUpdate = premiosUpdate[0] || '';
        
        result = await client.queryObject(`
          UPDATE sorteios 
          SET nome = $2, data_sorteio = $3, premio = $4, premios = $5::jsonb, valor_cartela = $6, quantidade_cartelas = $7, status = $8, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.nome, data.data_sorteio, premioUpdate, JSON.stringify(premiosUpdate), data.valor_cartela, data.quantidade_cartelas, data.status]);
        break;

      case 'deleteSorteio':
        result = await client.queryObject(`DELETE FROM sorteios WHERE id = $1`, [data.id]);
        break;

      // ================== VENDEDORES ==================
      case 'getVendedores':
        result = await client.queryObject(`
          SELECT * FROM vendedores WHERE sorteio_id = $1 ORDER BY nome
        `, [data.sorteio_id]);
        break;

      case 'createVendedor':
        result = await client.queryObject(`
          INSERT INTO vendedores (sorteio_id, nome, telefone, email, cpf, endereco, ativo)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [data.sorteio_id, data.nome, data.telefone, data.email, data.cpf, data.endereco, data.ativo]);
        break;

      case 'updateVendedor':
        result = await client.queryObject(`
          UPDATE vendedores 
          SET nome = $2, telefone = $3, email = $4, cpf = $5, endereco = $6, ativo = $7, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.nome, data.telefone, data.email, data.cpf, data.endereco, data.ativo]);
        break;

      case 'deleteVendedor':
        result = await client.queryObject(`DELETE FROM vendedores WHERE id = $1`, [data.id]);
        break;

      // ================== CARTELAS ==================
      case 'getCartelas':
        result = await client.queryObject(`
          SELECT * FROM cartelas WHERE sorteio_id = $1 ORDER BY numero
        `, [data.sorteio_id]);
        break;

      case 'updateCartela':
        result = await client.queryObject(`
          UPDATE cartelas 
          SET status = $2, vendedor_id = $3, updated_at = NOW()
          WHERE sorteio_id = $1 AND numero = $4
          RETURNING *
        `, [data.sorteio_id, data.status, data.vendedor_id, data.numero]);
        break;

      case 'updateCartelasBatch':
        // Update multiple cartelas at once
        for (const cartela of data.cartelas) {
          await client.queryObject(`
            UPDATE cartelas 
            SET status = $2, vendedor_id = $3, updated_at = NOW()
            WHERE sorteio_id = $1 AND numero = $4
          `, [data.sorteio_id, cartela.status, cartela.vendedor_id, cartela.numero]);
        }
        result = { rows: [{ success: true }] };
        break;

      case 'gerarCartelas': {
        // First delete existing cartelas
        await client.queryObject(`DELETE FROM cartelas WHERE sorteio_id = $1`, [data.sorteio_id]);
        
        // Insert cartelas in batches for better performance
        const batchSize = 500;
        const totalCartelas = Number(data.quantidade || 0);
        
        for (let batch = 0; batch < Math.ceil(totalCartelas / batchSize); batch++) {
          const startNum = batch * batchSize + 1;
          const endNum = Math.min((batch + 1) * batchSize, totalCartelas);
          
          // Build batch insert query
          const values: string[] = [];
          const params: any[] = [data.sorteio_id];
          let paramIndex = 2;
          
          for (let i = startNum; i <= endNum; i++) {
            values.push(`($1, $${paramIndex}, 'disponivel')`);
            params.push(i);
            paramIndex++;
          }
          
          if (values.length > 0) {
            await client.queryObject(`
              INSERT INTO cartelas (sorteio_id, numero, status)
              VALUES ${values.join(', ')}
            `, params);
          }
        }
        
        console.log(`Generated ${totalCartelas} cartelas in batches of ${batchSize}`);
        result = { rows: [{ success: true, quantidade: totalCartelas }] };
        break;
      }

      // ================== ATRIBUIÇÕES ==================
      case 'getAtribuicoes':
        result = await client.queryObject(`
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
        break;

      case 'createAtribuicao':
        const atribResult = await client.queryObject(`
          INSERT INTO atribuicoes (sorteio_id, vendedor_id)
          VALUES ($1, $2)
          RETURNING *
        `, [data.sorteio_id, data.vendedor_id]);
        
        const atribuicaoId = (atribResult.rows[0] as any).id;
        
        // Add cartelas to the attribution
        for (const cartela of data.cartelas) {
          await client.queryObject(`
            INSERT INTO atribuicao_cartelas (atribuicao_id, numero_cartela, status, data_atribuicao)
            VALUES ($1, $2, 'ativa', NOW())
          `, [atribuicaoId, cartela]);
          
          // Update cartela status
          await client.queryObject(`
            UPDATE cartelas SET status = 'ativa', vendedor_id = $1 WHERE sorteio_id = $2 AND numero = $3
          `, [data.vendedor_id, data.sorteio_id, cartela]);
        }
        
        result = atribResult;
        break;

      case 'addCartelasToAtribuicao':
        for (const cartela of data.cartelas) {
          await client.queryObject(`
            INSERT INTO atribuicao_cartelas (atribuicao_id, numero_cartela, status, data_atribuicao)
            VALUES ($1, $2, 'ativa', NOW())
          `, [data.atribuicao_id, cartela]);
          
          // Update cartela status
          await client.queryObject(`
            UPDATE cartelas SET status = 'ativa', vendedor_id = $1 WHERE sorteio_id = $2 AND numero = $3
          `, [data.vendedor_id, data.sorteio_id, cartela]);
        }
        result = { rows: [{ success: true }] };
        break;

      case 'removeCartelaFromAtribuicao':
        await client.queryObject(`
          DELETE FROM atribuicao_cartelas WHERE atribuicao_id = $1 AND numero_cartela = $2
        `, [data.atribuicao_id, data.numero_cartela]);
        
        // Update cartela status back to available
        await client.queryObject(`
          UPDATE cartelas SET status = 'disponivel', vendedor_id = NULL WHERE sorteio_id = $1 AND numero = $2
        `, [data.sorteio_id, data.numero_cartela]);
        
        result = { rows: [{ success: true }] };
        break;

      case 'updateCartelaStatusInAtribuicao':
        await client.queryObject(`
          UPDATE atribuicao_cartelas 
          SET status = $3, data_devolucao = CASE WHEN $3 = 'devolvida' THEN NOW() ELSE NULL END
          WHERE atribuicao_id = $1 AND numero_cartela = $2
        `, [data.atribuicao_id, data.numero_cartela, data.status]);
        
        // Update cartela status
        const cartelaStatus = data.status === 'devolvida' ? 'disponivel' : data.status;
        await client.queryObject(`
          UPDATE cartelas SET status = $3, vendedor_id = CASE WHEN $3 = 'disponivel' THEN NULL ELSE vendedor_id END
          WHERE sorteio_id = $1 AND numero = $2
        `, [data.sorteio_id, data.numero_cartela, cartelaStatus]);
        
        result = { rows: [{ success: true }] };
        break;

      case 'transferirCartela':
        // Get the origin cartela data
        const origemCartela = await client.queryObject(`
          SELECT * FROM atribuicao_cartelas WHERE atribuicao_id = $1 AND numero_cartela = $2
        `, [data.atribuicao_origem_id, data.numero_cartela]);
        
        if ((origemCartela.rows as any[]).length === 0) {
          throw new Error('Cartela não encontrada na atribuição de origem');
        }

        // Remove from origin attribution
        await client.queryObject(`
          DELETE FROM atribuicao_cartelas WHERE atribuicao_id = $1 AND numero_cartela = $2
        `, [data.atribuicao_origem_id, data.numero_cartela]);

        // Check if destination seller already has an attribution
        const destAtribuicao = await client.queryObject(`
          SELECT id FROM atribuicoes WHERE sorteio_id = $1 AND vendedor_id = $2
        `, [data.sorteio_id, data.vendedor_destino_id]);

        let destAtribuicaoId: string;

        if ((destAtribuicao.rows as any[]).length > 0) {
          // Add to existing attribution
          destAtribuicaoId = (destAtribuicao.rows[0] as any).id;
        } else {
          // Create new attribution for destination seller
          const newAtrib = await client.queryObject(`
            INSERT INTO atribuicoes (sorteio_id, vendedor_id)
            VALUES ($1, $2)
            RETURNING id
          `, [data.sorteio_id, data.vendedor_destino_id]);
          destAtribuicaoId = (newAtrib.rows[0] as any).id;
        }

        // Add cartela to destination attribution
        await client.queryObject(`
          INSERT INTO atribuicao_cartelas (atribuicao_id, numero_cartela, status, data_atribuicao)
          VALUES ($1, $2, 'ativa', NOW())
        `, [destAtribuicaoId, data.numero_cartela]);

        // Update cartela vendedor_id
        await client.queryObject(`
          UPDATE cartelas SET vendedor_id = $1 WHERE sorteio_id = $2 AND numero = $3
        `, [data.vendedor_destino_id, data.sorteio_id, data.numero_cartela]);

        // Check if origin attribution has no more cartelas, delete it
        const remainingCartelas = await client.queryObject(`
          SELECT COUNT(*) as count FROM atribuicao_cartelas WHERE atribuicao_id = $1
        `, [data.atribuicao_origem_id]);
        
        if (parseInt((remainingCartelas.rows[0] as any).count) === 0) {
          await client.queryObject(`DELETE FROM atribuicoes WHERE id = $1`, [data.atribuicao_origem_id]);
        }

        console.log(`Cartela ${data.numero_cartela} transferred to vendedor ${data.vendedor_destino_id}`);
        result = { rows: [{ success: true }] };
        break;

      case 'deleteAtribuicao':
        const cartelasResult = await client.queryObject(`
          SELECT numero_cartela FROM atribuicao_cartelas WHERE atribuicao_id = $1
        `, [data.atribuicao_id]);
        
        // Update cartelas back to available
        for (const row of cartelasResult.rows as any[]) {
          await client.queryObject(`
            UPDATE cartelas SET status = 'disponivel', vendedor_id = NULL WHERE sorteio_id = $1 AND numero = $2
          `, [data.sorteio_id, row.numero_cartela]);
        }
        
        // Delete cartelas from attribution
        await client.queryObject(`DELETE FROM atribuicao_cartelas WHERE atribuicao_id = $1`, [data.atribuicao_id]);
        
        // Delete attribution
        await client.queryObject(`DELETE FROM atribuicoes WHERE id = $1`, [data.atribuicao_id]);
        
        result = { rows: [{ success: true }] };
        break;

      // ================== VENDAS ==================
      case 'getVendas':
        result = await client.queryObject(`
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
        break;

      case 'createVenda':
        const vendaResult = await client.queryObject(`
          INSERT INTO vendas (sorteio_id, vendedor_id, cliente_nome, cliente_telefone, numeros_cartelas, valor_total, valor_pago, status, data_venda)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING *
        `, [data.sorteio_id, data.vendedor_id, data.cliente_nome, data.cliente_telefone, data.numeros_cartelas, data.valor_total, data.valor_pago, data.status]);
        
        const vendaId = (vendaResult.rows[0] as any).id;
        
        // Add payments
        if (data.pagamentos && data.pagamentos.length > 0) {
          for (const pag of data.pagamentos) {
            await client.queryObject(`
              INSERT INTO pagamentos (venda_id, forma_pagamento, valor, data_pagamento)
              VALUES ($1, $2, $3, NOW())
            `, [vendaId, pag.forma_pagamento, pag.valor]);
          }
        }
        
        // Update cartelas status
        const numerosVenda = data.numeros_cartelas.split(',').map((n: string) => parseInt(n.trim()));
        for (const numero of numerosVenda) {
          await client.queryObject(`
            UPDATE cartelas SET status = 'vendida' WHERE sorteio_id = $1 AND numero = $2
          `, [data.sorteio_id, numero]);
          
          // Update atribuicao_cartelas
          await client.queryObject(`
            UPDATE atribuicao_cartelas SET status = 'vendida', venda_id = $1 
            WHERE numero_cartela = $2 AND atribuicao_id IN (
              SELECT id FROM atribuicoes WHERE sorteio_id = $3 AND vendedor_id = $4
            )
          `, [vendaId, numero, data.sorteio_id, data.vendedor_id]);
        }
        
        result = vendaResult;
        break;

      case 'updateVenda':
        // Get old cartelas
        const oldVendaResult = await client.queryObject(`
          SELECT numeros_cartelas, vendedor_id FROM vendas WHERE id = $1
        `, [data.id]);
        const oldVenda = oldVendaResult.rows[0] as any;
        const oldNumeros = oldVenda?.numeros_cartelas?.split(',').map((n: string) => parseInt(n.trim())) || [];
        const newNumeros = data.numeros_cartelas.split(',').map((n: string) => parseInt(n.trim()));
        
        // Cartelas removed - return to 'ativa'
        const removedCartelas = oldNumeros.filter((n: number) => !newNumeros.includes(n));
        for (const numero of removedCartelas) {
          await client.queryObject(`
            UPDATE cartelas SET status = 'ativa' WHERE sorteio_id = $1 AND numero = $2
          `, [data.sorteio_id, numero]);
          
          await client.queryObject(`
            UPDATE atribuicao_cartelas SET status = 'ativa', venda_id = NULL 
            WHERE numero_cartela = $1 AND atribuicao_id IN (
              SELECT id FROM atribuicoes WHERE sorteio_id = $2
            )
          `, [numero, data.sorteio_id]);
        }
        
        // Cartelas added - set to 'vendida'
        const addedCartelas = newNumeros.filter((n: number) => !oldNumeros.includes(n));
        for (const numero of addedCartelas) {
          await client.queryObject(`
            UPDATE cartelas SET status = 'vendida' WHERE sorteio_id = $1 AND numero = $2
          `, [data.sorteio_id, numero]);
          
          await client.queryObject(`
            UPDATE atribuicao_cartelas SET status = 'vendida', venda_id = $1 
            WHERE numero_cartela = $2 AND atribuicao_id IN (
              SELECT id FROM atribuicoes WHERE sorteio_id = $3 AND vendedor_id = $4
            )
          `, [data.id, numero, data.sorteio_id, data.vendedor_id]);
        }
        
        // Delete old payments and add new ones
        await client.queryObject(`DELETE FROM pagamentos WHERE venda_id = $1`, [data.id]);
        if (data.pagamentos && data.pagamentos.length > 0) {
          for (const pag of data.pagamentos) {
            await client.queryObject(`
              INSERT INTO pagamentos (venda_id, forma_pagamento, valor, data_pagamento)
              VALUES ($1, $2, $3, NOW())
            `, [data.id, pag.forma_pagamento, pag.valor]);
          }
        }
        
        result = await client.queryObject(`
          UPDATE vendas 
          SET vendedor_id = $2, cliente_nome = $3, cliente_telefone = $4, numeros_cartelas = $5, 
              valor_total = $6, valor_pago = $7, status = $8, updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [data.id, data.vendedor_id, data.cliente_nome, data.cliente_telefone, data.numeros_cartelas, data.valor_total, data.valor_pago, data.status]);
        break;

      case 'deleteVenda':
        // Get cartelas from this sale
        const vendaToDeleteResult = await client.queryObject(`
          SELECT numeros_cartelas, sorteio_id, vendedor_id FROM vendas WHERE id = $1
        `, [data.id]);
        const vendaToDelete = vendaToDeleteResult.rows[0] as any;
        
        if (vendaToDelete) {
          const numerosToReturn = vendaToDelete.numeros_cartelas.split(',').map((n: string) => parseInt(n.trim()));
          
          // Return cartelas to 'ativa' status
          for (const numero of numerosToReturn) {
            await client.queryObject(`
              UPDATE cartelas SET status = 'ativa' WHERE sorteio_id = $1 AND numero = $2
            `, [vendaToDelete.sorteio_id, numero]);
            
            await client.queryObject(`
              UPDATE atribuicao_cartelas SET status = 'ativa', venda_id = NULL 
              WHERE numero_cartela = $1 AND atribuicao_id IN (
                SELECT id FROM atribuicoes WHERE sorteio_id = $2
              )
            `, [numero, vendaToDelete.sorteio_id]);
          }
        }
        
        // Delete payments
        await client.queryObject(`DELETE FROM pagamentos WHERE venda_id = $1`, [data.id]);
        
        // Delete sale
        await client.queryObject(`DELETE FROM vendas WHERE id = $1`, [data.id]);
        
        result = { rows: [{ success: true }] };
        break;

      case 'addPagamento':
        await client.queryObject(`
          INSERT INTO pagamentos (venda_id, forma_pagamento, valor, observacao, data_pagamento)
          VALUES ($1, $2, $3, $4, NOW())
        `, [data.venda_id, data.forma_pagamento, data.valor, data.observacao]);
        
        // Update total paid and status
        const totalPaidResult = await client.queryObject(`
          SELECT COALESCE(SUM(valor), 0) as total_pago FROM pagamentos WHERE venda_id = $1
        `, [data.venda_id]);
        const totalPaid = parseFloat((totalPaidResult.rows[0] as any).total_pago) || 0;
        
        const vendaInfoResult = await client.queryObject(`
          SELECT valor_total FROM vendas WHERE id = $1
        `, [data.venda_id]);
        const valorTotal = parseFloat((vendaInfoResult.rows[0] as any).valor_total) || 0;
        
        const newStatus = totalPaid >= valorTotal ? 'concluida' : 'pendente';
        
        await client.queryObject(`
          UPDATE vendas SET valor_pago = $2, status = $3, updated_at = NOW() WHERE id = $1
        `, [data.venda_id, totalPaid, newStatus]);
        
        result = { rows: [{ success: true, total_pago: totalPaid, status: newStatus }] };
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ data: result.rows }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Database error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Database error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
  }
});
