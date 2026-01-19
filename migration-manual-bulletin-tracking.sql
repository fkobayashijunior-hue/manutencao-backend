-- Tabela de Assinaturas do Manual do Colaborador
CREATE TABLE IF NOT EXISTS manual_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_cpf VARCHAR(14),
  ip_address VARCHAR(45),
  signed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_signed_at (signed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Visualizações do Mural de Recados
CREATE TABLE IF NOT EXISTS bulletin_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_cpf VARCHAR(14),
  bulletin_id INT,
  ip_address VARCHAR(45),
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_bulletin_id (bulletin_id),
  INDEX idx_viewed_at (viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
