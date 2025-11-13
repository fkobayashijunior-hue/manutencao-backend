-- Tabela para Mural de Recados
CREATE TABLE IF NOT EXISTS bulletin_board (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category ENUM('Aviso', 'Evento', 'Comunicado', 'Urgente', 'Geral') DEFAULT 'Geral',
  color VARCHAR(20) DEFAULT 'yellow',
  is_pinned BOOLEAN DEFAULT FALSE,
  expires_at DATETIME NULL,
  created_by INT NOT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_pinned (is_pinned),
  INDEX idx_expires (expires_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir alguns recados de exemplo
INSERT INTO bulletin_board (title, content, category, color, is_pinned, created_by, created_by_name) VALUES
('Bem-vindo ao Mural de Recados! 📌', 'Este é o novo mural digital da empresa. Aqui você encontrará avisos importantes, eventos e comunicados.', 'Comunicado', 'blue', TRUE, 1, 'Sistema'),
('Reunião Geral - Sexta-feira', 'Reunião geral de equipe na sexta-feira às 14h no auditório. Presença obrigatória.', 'Evento', 'green', FALSE, 1, 'Administração'),
('Horário de Verão', 'Atenção! A partir de segunda-feira teremos novo horário de funcionamento: 7h às 16h.', 'Aviso', 'orange', TRUE, 1, 'RH');

