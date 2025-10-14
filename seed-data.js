const axios = require('axios');

const API_URL = 'https://manutencao-backendd.onrender.com';

const initialData = {
  users: [
    {
      id: 1,
      name: 'Gestor Principal',
      username: 'gestor',
      password: '123',
      role: 'Gestor do Sistema',
      sector: '',
      birthdate: ''
    }
  ],
  assets: [],
  sectors: [
    {
      id: 1,
      nome: 'Tecelagem',
      descricao: 'Setor de tecelagem',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      nome: 'Acabamento',
      descricao: 'Setor de acabamento',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      nome: 'Costura',
      descricao: 'Setor de costura',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 4,
      nome: 'Manutenção',
      descricao: 'Setor de manutenção',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 5,
      nome: 'Administrativo',
      descricao: 'Setor administrativo',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
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

async function seedData() {
  try {
    console.log('🌱 Populando dados iniciais...');
    console.log(`📡 API: ${API_URL}`);
    
    const response = await axios.post(`${API_URL}/api/data`, initialData);
    
    console.log('✅ Dados populados com sucesso!');
    console.log('📊 Dados criados:');
    console.log(`   - ${initialData.users.length} usuário(s)`);
    console.log(`   - ${initialData.sectors.length} setor(es)`);
    console.log('');
    console.log('🔑 Credenciais de acesso:');
    console.log('   Usuário: gestor');
    console.log('   Senha: 123');
  } catch (error) {
    console.error('❌ Erro ao popular dados:', error.message);
    if (error.response) {
      console.error('   Resposta:', error.response.data);
    }
  }
}

seedData();

