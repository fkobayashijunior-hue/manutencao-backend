const mysql = require('mysql2/promise');

// Configuração de conexão MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'srv572.hstgr.io',
  user: process.env.DB_USER || 'u629128033_azaconnect',
  password: process.env.DB_PASSWORD || 'Aza@2025!',
  database: process.env.DB_NAME || 'u629128033_azaconnect',
  port: process.env.DB_PORT || 3306,
  timezone: '-03:00', // Brasil (GMT-3)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Testar conexão
pool.getConnection()
  .then(connection => {
    console.log('✅ Conectado ao MySQL com sucesso!');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao MySQL:', err.message);
  });

// Tratar erros de conexão
pool.on('error', (err) => {
  console.error('❌ Erro inesperado no MySQL:', err);
});

module.exports = pool;

