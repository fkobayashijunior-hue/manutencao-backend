-- Criar tabela de comentários para pedidos de manutenção (parts_requests)
-- Sistema Aza Connect

CREATE TABLE IF NOT EXISTS parts_request_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES parts_requests(id) ON DELETE CASCADE,
  INDEX idx_request_id (request_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar tabela criada
DESCRIBE parts_request_comments;

