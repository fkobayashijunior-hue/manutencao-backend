const express = require('express');
const cors = require('cors');
const pool = require('./database');
const initDatabase = require('./init-database');

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors({
  origin: '*', // Permitir todas as origens (ajuste em produção se necessário)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Inicializar banco de dados ao iniciar servidor
initDatabase().catch(err => {
  console.error('❌ Falha ao inicializar banco de dados:', err);
});

// ==================== ROTAS ====================

// Rota raiz - Status da API
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Sistema de Manutenção v2.0',
    status: 'online',
    database: 'PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// GET - Carregar todos os dados
app.get('/api/data', async (req, res) => {
  try {
    console.log('📥 Carregando todos os dados...');
    
    const result = await pool.query(
      'SELECT data_value FROM system_data WHERE data_key = $1',
      ['allData']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Dados carregados do banco de dados');
      res.json(result.rows[0].data_value);
    } else {
      console.log('ℹ️  Nenhum dado encontrado, retornando estrutura vazia');
      // Retornar estrutura vazia se não houver dados
      const emptyData = {
        users: [],
        assets: [],
        sectors: [],
        requests: [],
        agulhas: [],
        pdfs: [],
        partRequests: [],
        notifications: [],
        permissions: {
          'Gestor do Sistema': ['all'],
          'Encarregado': ['newRequest', 'myRequests', 'sectorHistory', 'sectorPDFs', 'uploadPDF'],
          'Mecânico': ['requests', 'partRequests', 'agulhas', 'maintenance'],
          'Tecelão': ['newRequest', 'myRequests', 'agulhas', 'sectorPDFs']
        }
      };
      res.json(emptyData);
    }
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    res.status(500).json({ 
      error: 'Erro ao carregar dados',
      message: error.message 
    });
  }
});

// POST - Salvar todos os dados
app.post('/api/data', async (req, res) => {
  try {
    const allData = req.body;
    
    console.log('💾 Salvando todos os dados...');
    console.log(`📊 Usuários: ${allData.users?.length || 0}, Equipamentos: ${allData.assets?.length || 0}, Solicitações: ${allData.requests?.length || 0}`);
    
    await pool.query(
      `INSERT INTO system_data (data_key, data_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (data_key)
       DO UPDATE SET data_value = $2, updated_at = CURRENT_TIMESTAMP`,
      ['allData', JSON.stringify(allData)]
    );
    
    console.log('✅ Dados salvos com sucesso no PostgreSQL!');
    res.json({ 
      success: true, 
      message: 'Dados salvos com sucesso!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao salvar dados:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar dados',
      message: error.message
    });
  }
});

// POST - Salvar usuário individual
app.post('/api/users', async (req, res) => {
  try {
    const user = req.body;
    console.log(`👤 Salvando usuário: ${user.name} (ID: ${user.id})`);
    
    // Carregar dados atuais
    const result = await pool.query(
      'SELECT data_value FROM system_data WHERE data_key = $1',
      ['allData']
    );
    
    let allData = result.rows.length > 0 ? result.rows[0].data_value : { 
      users: [], 
      assets: [], 
      sectors: [], 
      requests: [], 
      agulhas: [],
      pdfs: [],
      partRequests: [],
      notifications: [],
      permissions: {}
    };
    
    // Garantir que users existe
    if (!allData.users) allData.users = [];
    
    // Adicionar ou atualizar usuário
    const userIndex = allData.users.findIndex(u => u.id === user.id);
    if (userIndex >= 0) {
      allData.users[userIndex] = user;
      console.log(`✏️  Usuário atualizado`);
    } else {
      allData.users.push(user);
      console.log(`➕ Novo usuário adicionado`);
    }
    
    // Salvar de volta
    await pool.query(
      `INSERT INTO system_data (data_key, data_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (data_key)
       DO UPDATE SET data_value = $2, updated_at = CURRENT_TIMESTAMP`,
      ['allData', JSON.stringify(allData)]
    );
    
    console.log('✅ Usuário salvo com sucesso!');
    res.json({ success: true, message: 'Usuário salvo com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao salvar usuário:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar usuário',
      message: error.message
    });
  }
});

// POST - Salvar equipamento individual
app.post('/api/assets', async (req, res) => {
  try {
    const asset = req.body;
    console.log(`🔧 Salvando equipamento: ${asset.name} (ID: ${asset.id})`);
    
    const result = await pool.query(
      'SELECT data_value FROM system_data WHERE data_key = $1',
      ['allData']
    );
    
    let allData = result.rows.length > 0 ? result.rows[0].data_value : { 
      users: [], 
      assets: [], 
      sectors: [], 
      requests: [], 
      agulhas: [],
      pdfs: [],
      partRequests: [],
      notifications: [],
      permissions: {}
    };
    
    if (!allData.assets) allData.assets = [];
    
    const assetIndex = allData.assets.findIndex(a => a.id === asset.id);
    if (assetIndex >= 0) {
      allData.assets[assetIndex] = asset;
      console.log(`✏️  Equipamento atualizado`);
    } else {
      allData.assets.push(asset);
      console.log(`➕ Novo equipamento adicionado`);
    }
    
    await pool.query(
      `INSERT INTO system_data (data_key, data_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (data_key)
       DO UPDATE SET data_value = $2, updated_at = CURRENT_TIMESTAMP`,
      ['allData', JSON.stringify(allData)]
    );
    
    console.log('✅ Equipamento salvo com sucesso!');
    res.json({ success: true, message: 'Equipamento salvo com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao salvar equipamento:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar equipamento',
      message: error.message
    });
  }
});

// POST - Salvar solicitação individual
app.post('/api/requests', async (req, res) => {
  try {
    const request = req.body;
    console.log(`📋 Salvando solicitação: ID ${request.id}`);
    
    const result = await pool.query(
      'SELECT data_value FROM system_data WHERE data_key = $1',
      ['allData']
    );
    
    let allData = result.rows.length > 0 ? result.rows[0].data_value : { 
      users: [], 
      assets: [], 
      sectors: [], 
      requests: [], 
      agulhas: [],
      pdfs: [],
      partRequests: [],
      notifications: [],
      permissions: {}
    };
    
    if (!allData.requests) allData.requests = [];
    
    const requestIndex = allData.requests.findIndex(r => r.id === request.id);
    if (requestIndex >= 0) {
      allData.requests[requestIndex] = request;
      console.log(`✏️  Solicitação atualizada`);
    } else {
      allData.requests.push(request);
      console.log(`➕ Nova solicitação adicionada`);
    }
    
    await pool.query(
      `INSERT INTO system_data (data_key, data_value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (data_key)
       DO UPDATE SET data_value = $2, updated_at = CURRENT_TIMESTAMP`,
      ['allData', JSON.stringify(allData)]
    );
    
    console.log('✅ Solicitação salva com sucesso!');
    res.json({ success: true, message: 'Solicitação salva com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao salvar solicitação:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar solicitação',
      message: error.message
    });
  }
});

// Rota de health check
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Tratamento de rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.path
  });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('🚀 Servidor iniciado com sucesso!');
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🗄️  Banco de dados: PostgreSQL`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(50));
  console.log('');
});

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM recebido, encerrando servidor...');
  pool.end(() => {
    console.log('✅ Pool do PostgreSQL encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT recebido, encerrando servidor...');
  pool.end(() => {
    console.log('✅ Pool do PostgreSQL encerrado');
    process.exit(0);
  });
});

