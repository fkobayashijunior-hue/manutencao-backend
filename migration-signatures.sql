-- Tabela de assinaturas do Manual do Colaborador
CREATE TABLE IF NOT EXISTS manual_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_cpf VARCHAR(14),
  user_role VARCHAR(100),
  document_version VARCHAR(50) DEFAULT '1.0',
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  signature_hash VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_signed_at (signed_at),
  INDEX idx_document_version (document_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de confirmações de leitura do Mural
CREATE TABLE IF NOT EXISTS bulletin_confirmations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bulletin_id INT NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (bulletin_id) REFERENCES bulletin_board(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_confirmation (bulletin_id, user_id),
  INDEX idx_bulletin_id (bulletin_id),
  INDEX idx_user_id (user_id),
  INDEX idx_confirmed_at (confirmed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
