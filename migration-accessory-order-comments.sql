-- Criar tabela de comentários para pedidos de acessórios (accessory_orders)
-- Sistema Aza Connect

CREATE TABLE IF NOT EXISTS accessory_order_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES accessory_orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificar tabela criada
DESCRIBE accessory_order_comments;

