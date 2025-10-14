const pool = require('./database');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  console.log('🔧 Inicializando banco de dados...');
  
  try {
    // Verificar se as tabelas já existem
    const checkTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'sectors', 'assets', 'requests', 'agulhas')
    `);
    
    if (checkTables.rows.length > 0) {
      console.log('✅ Tabelas já existem no banco de dados!');
      console.log(`📊 Tabelas encontradas: ${checkTables.rows.map(r => r.table_name).join(', ')}`);
      return;
    }
    
    console.log('📝 Criando estrutura do banco de dados...');
    
    // Ler e executar o schema SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    
    console.log('✅ Schema criado com sucesso!');
    console.log('✅ Dados iniciais inseridos!');
    console.log('✅ Banco de dados pronto para uso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

module.exports = initDatabase;

