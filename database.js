const { Pool } = require('pg');

// Conectar ao PostgreSQL usando a variável de ambiente DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Necessário para Render
  } : false
});

// Testar conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.stack);
  } else {
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    release();
  }
});

// Tratar erros de conexão
pool.on('error', (err) => {
  console.error('❌ Erro inesperado no PostgreSQL:', err);
});

module.exports = pool;

