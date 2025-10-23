// ==========================================
// CONFIGURAÇÃO DO BANCO DE DADOS MYSQL HOSTINGER
// Conexão remota do Render para MySQL da Hostinger
// ==========================================

require('dotenv').config();
const mysql = require('mysql2/promise');

// Configuração do pool de conexões MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000, // 60 segundos
  ssl: {
    rejectUnauthorized: false // Necessário para conexão remota
  }
});

// Testar conexão
pool.getConnection()
  .then(connection => {
    console.log('✅ Conectado ao MySQL Hostinger com sucesso!');
    console.log(`📊 Banco de dados: ${process.env.DB_NAME}`);
    console.log(`🌐 Host: ${process.env.DB_HOST}`);
    connection.release();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao MySQL Hostinger:', err.message);
    console.error('💡 Verifique se o acesso remoto está habilitado no MySQL da Hostinger');
  });

// Função auxiliar para executar queries (compatibilidade com PostgreSQL)
const query = async (text, params) => {
  try {
    // Converter placeholders PostgreSQL ($1, $2) para MySQL (?, ?)
    let mysqlQuery = text;
    
    // Substituir $1, $2, etc por ?
    if (params && params.length > 0) {
      for (let i = params.length; i >= 1; i--) {
        mysqlQuery = mysqlQuery.replace(new RegExp(`\\$${i}`, 'g'), '?');
      }
    }
    
    // Converter RETURNING para SELECT LAST_INSERT_ID() (MySQL não suporta RETURNING)
    if (mysqlQuery.includes('RETURNING')) {
      mysqlQuery = mysqlQuery.replace(/RETURNING \*/gi, '');
      const [result] = await pool.execute(mysqlQuery, params);
      
      // Se foi INSERT, retornar o ID inserido
      if (result.insertId) {
        const [rows] = await pool.execute(
          `SELECT * FROM ${getTableName(mysqlQuery)} WHERE id = ?`,
          [result.insertId]
        );
        return { rows };
      }
      
      return { rows: [result] };
    }
    
    // Converter CURRENT_TIMESTAMP para NOW()
    mysqlQuery = mysqlQuery.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');
    
    // Executar query
    const [rows] = await pool.execute(mysqlQuery, params);
    
    // MySQL retorna arrays, PostgreSQL retorna objetos com .rows
    // Manter compatibilidade
    return { rows: Array.isArray(rows) ? rows : [rows] };
  } catch (error) {
    console.error('❌ Erro na query:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
};

// Função auxiliar para extrair nome da tabela da query
function getTableName(query) {
  const match = query.match(/(?:INTO|FROM|UPDATE)\s+([a-zA-Z_]+)/i);
  return match ? match[1] : null;
}

// Exportar pool e função query
module.exports = {
  pool,
  query
};

