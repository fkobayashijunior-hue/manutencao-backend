-- ==========================================
-- SCHEMA DO BANCO DE DADOS AZA CONNECT
-- Sistema de Gestão de Manutenção Industrial
-- ==========================================

-- Limpar tabelas existentes (cuidado em produção!)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS parts_requests CASCADE;
DROP TABLE IF EXISTS pdfs CASCADE;
DROP TABLE IF EXISTS agulhas CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS sectors CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS system_data CASCADE;

-- ==========================================
-- TABELA: users
-- Usuários do sistema
-- ==========================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  sector VARCHAR(100),
  birthdate DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ==========================================
-- TABELA: sectors
-- Setores da empresa
-- ==========================================
CREATE TABLE sectors (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para sectors
CREATE INDEX idx_sectors_ativo ON sectors(ativo);

-- ==========================================
-- TABELA: assets
-- Equipamentos/Ativos da empresa
-- ==========================================
CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  number VARCHAR(50),
  model VARCHAR(255),
  serial_number VARCHAR(255),
  sector VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Ativo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para assets
CREATE INDEX idx_assets_sector ON assets(sector);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_type ON assets(type);

-- ==========================================
-- TABELA: requests
-- Solicitações de manutenção
-- ==========================================
CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  equipment VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  description TEXT NOT NULL,
  urgency VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pendente',
  requested_by VARCHAR(255) NOT NULL,
  assigned_to VARCHAR(255),
  service_executed TEXT,
  preventive_maintenance DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para requests
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_sector ON requests(sector);
CREATE INDEX idx_requests_urgency ON requests(urgency);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_requests_created_at ON requests(created_at);

-- ==========================================
-- TABELA: agulhas
-- Controle de consumo de agulhas (tecelagem)
-- ==========================================
CREATE TABLE agulhas (
  id SERIAL PRIMARY KEY,
  tear VARCHAR(50) NOT NULL,
  size VARCHAR(10) NOT NULL CHECK (size IN ('P', 'G')),
  quantity INTEGER NOT NULL DEFAULT 1,
  employee VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para agulhas
CREATE INDEX idx_agulhas_date ON agulhas(date);
CREATE INDEX idx_agulhas_tear ON agulhas(tear);
CREATE INDEX idx_agulhas_employee ON agulhas(employee);

-- ==========================================
-- TABELA: pdfs
-- PDFs por setor
-- ==========================================
CREATE TABLE pdfs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para pdfs
CREATE INDEX idx_pdfs_sector ON pdfs(sector);

-- ==========================================
-- TABELA: parts_requests
-- Solicitações de peças
-- ==========================================
CREATE TABLE parts_requests (
  id SERIAL PRIMARY KEY,
  part_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  equipment VARCHAR(255),
  sector VARCHAR(100),
  requested_by VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pendente',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para parts_requests
CREATE INDEX idx_parts_requests_status ON parts_requests(status);
CREATE INDEX idx_parts_requests_sector ON parts_requests(sector);

-- ==========================================
-- TABELA: notifications
-- Notificações do sistema
-- ==========================================
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ==========================================
-- TABELA: permissions
-- Permissões por role
-- ==========================================
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(100) UNIQUE NOT NULL,
  permissions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- TABELA: system_data (backup/compatibilidade)
-- Armazenamento JSONB para compatibilidade
-- ==========================================
CREATE TABLE system_data (
  id SERIAL PRIMARY KEY,
  data_key VARCHAR(100) UNIQUE NOT NULL,
  data_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_data_key ON system_data(data_key);

-- ==========================================
-- DADOS INICIAIS
-- ==========================================

-- Usuário gestor padrão
INSERT INTO users (name, username, password, role, sector, birthdate) VALUES
('Gestor Principal', 'gestor', '123', 'Gestor do Sistema', '', NULL);

-- Setores padrão
INSERT INTO sectors (nome, descricao, ativo) VALUES
('Tecelagem', 'Setor de tecelagem', true),
('Acabamento', 'Setor de acabamento', true),
('Costura', 'Setor de costura', true),
('Manutenção', 'Setor de manutenção', true),
('Administrativo', 'Setor administrativo', true);

-- Permissões padrão
INSERT INTO permissions (role, permissions) VALUES
('Gestor do Sistema', '["all"]'),
('Encarregado', '["newRequest", "myRequests", "sectorHistory", "sectorPDFs", "uploadPDF"]'),
('Mecânico', '["requests", "partRequests", "agulhas", "maintenance"]'),
('Tecelão', '["newRequest", "myRequests", "agulhas", "sectorPDFs"]');

-- ==========================================
-- FUNÇÕES E TRIGGERS
-- ==========================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON sectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_requests_updated_at BEFORE UPDATE ON parts_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- COMENTÁRIOS
-- ==========================================

COMMENT ON TABLE users IS 'Usuários do sistema com autenticação';
COMMENT ON TABLE sectors IS 'Setores/Departamentos da empresa';
COMMENT ON TABLE assets IS 'Equipamentos e ativos da empresa';
COMMENT ON TABLE requests IS 'Solicitações de manutenção';
COMMENT ON TABLE agulhas IS 'Controle de consumo de agulhas (tecelagem)';
COMMENT ON TABLE pdfs IS 'Documentos PDF por setor';
COMMENT ON TABLE parts_requests IS 'Solicitações de peças para manutenção';
COMMENT ON TABLE notifications IS 'Notificações do sistema para usuários';
COMMENT ON TABLE permissions IS 'Permissões de acesso por role';
COMMENT ON TABLE system_data IS 'Dados do sistema em formato JSONB (backup/compatibilidade)';

-- ==========================================
-- FIM DO SCHEMA
-- ==========================================

