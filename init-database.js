const pool = require('./database');

async function initDatabase() {
  console.log('🔧 Inicializando banco de dados...');
  
  try {
    // Criar tabela principal para armazenar todos os dados do sistema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_data (
        id SERIAL PRIMARY KEY,
        data_key VARCHAR(100) UNIQUE NOT NULL,
        data_value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Tabela system_data criada com sucesso!');
    
    // Criar índice para melhorar performance nas consultas
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_data_key ON system_data(data_key);
    `);
    
    console.log('✅ Índice criado com sucesso!');
    
    // Verificar se já existem dados
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM system_data WHERE data_key = $1',
      ['allData']
    );
    
    if (parseInt(result.rows[0].count) === 0) {
      console.log('ℹ️  Nenhum dado encontrado. Banco está pronto para receber dados.');
    } else {
      console.log('✅ Dados existentes encontrados no banco!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

module.exports = initDatabase;

