-- ==========================================
-- FIX: Tabela permissions para MySQL
-- Data: 16/11/2025
-- ==========================================

-- Dropar tabela antiga se existir (cuidado: apaga dados!)
DROP TABLE IF EXISTS permissions;

-- Criar tabela correta para MySQL
CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  permissions JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar índice para performance
CREATE INDEX idx_user_id ON permissions(user_id);

-- ==========================================
-- Fim do script
-- ==========================================

