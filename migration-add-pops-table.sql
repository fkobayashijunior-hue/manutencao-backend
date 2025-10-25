-- Migration: Adicionar tabela POPs
-- Data: 25/10/2025
-- Descrição: Cria tabela pops (Procedimentos Operacionais Padrão) similar à tabela pdfs

CREATE TABLE IF NOT EXISTS pops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  sector VARCHAR(100),
  scope ENUM('sector', 'company') DEFAULT 'sector',
  uploaded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX idx_pops_sector ON pops(sector);
CREATE INDEX idx_pops_scope ON pops(scope);
CREATE INDEX idx_pops_created_at ON pops(created_at);

