const pool = require('./database');

async function initDatabase() {
  console.log('🔧 Inicializando banco de dados...');
  
  try {
    // Verificar se as tabelas já existem (MySQL usa information_schema diferente)
    const [checkTables] = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_name IN ('users', 'sectors', 'assets', 'requests', 'agulhas', 'pdfs', 'parts_requests', 'notifications', 'permissions')
    `);
    
    if (checkTables.length > 0) {
      console.log('✅ Tabelas já existem no banco de dados!');
      console.log(`📊 Tabelas encontradas: ${checkTables.map(r => r.table_name || r.TABLE_NAME).join(', ')}`);
      return;
    }
    
    console.log('📝 Banco de dados está vazio. As tabelas devem ser criadas manualmente via phpMyAdmin ou SQL.');
    console.log('⚠️  Por favor, execute o schema.sql no banco de dados MySQL.');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    // Não lançar erro para não impedir o servidor de iniciar
  }
}

module.exports = initDatabase;

