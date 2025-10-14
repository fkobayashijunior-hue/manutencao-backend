-- ==========================================
-- MIGRAÇÃO SEGURA DO BANCO DE DADOS
-- Aza Connect v3.0 - PostgreSQL
-- ==========================================
-- Este script cria as novas tabelas SEM deletar dados existentes
-- ==========================================

-- Criar tabelas apenas se não existirem
CREATE TABLE IF NOT EXISTS users (
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

CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
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

CREATE TABLE IF NOT EXISTS requests (
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

CREATE TABLE IF NOT EXISTS agulhas (
  id SERIAL PRIMARY KEY,
  tear VARCHAR(50) NOT NULL,
  size VARCHAR(10) NOT NULL CHECK (size IN ('P', 'G')),
  quantity INTEGER NOT NULL DEFAULT 1,
  employee VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pdfs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parts_requests (
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

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(100) UNIQUE NOT NULL,
  permissions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manter a tabela system_data para compatibilidade
CREATE TABLE IF NOT EXISTS system_data (
  id SERIAL PRIMARY KEY,
  data_key VARCHAR(100) UNIQUE NOT NULL,
  data_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CRIAR ÍNDICES (apenas se não existirem)
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sectors_ativo ON sectors(ativo);
CREATE INDEX IF NOT EXISTS idx_assets_sector ON assets(sector);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_sector ON requests(sector);
CREATE INDEX IF NOT EXISTS idx_requests_urgency ON requests(urgency);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_agulhas_date ON agulhas(date);
CREATE INDEX IF NOT EXISTS idx_agulhas_tear ON agulhas(tear);
CREATE INDEX IF NOT EXISTS idx_agulhas_employee ON agulhas(employee);
CREATE INDEX IF NOT EXISTS idx_pdfs_sector ON pdfs(sector);
CREATE INDEX IF NOT EXISTS idx_parts_requests_status ON parts_requests(status);
CREATE INDEX IF NOT EXISTS idx_parts_requests_sector ON parts_requests(sector);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_system_data_key ON system_data(data_key);

-- ==========================================
-- INSERIR DADOS INICIAIS (apenas se não existirem)
-- ==========================================

-- Usuário gestor padrão
INSERT INTO users (name, username, password, role, sector, birthdate)
SELECT 'Gestor Principal', 'gestor', '123', 'Gestor do Sistema', '', NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'gestor');

-- Setores padrão
INSERT INTO sectors (nome, descricao, ativo)
SELECT 'Tecelagem', 'Setor de tecelagem', true
WHERE NOT EXISTS (SELECT 1 FROM sectors WHERE nome = 'Tecelagem');

INSERT INTO sectors (nome, descricao, ativo)
SELECT 'Acabamento', 'Setor de acabamento', true
WHERE NOT EXISTS (SELECT 1 FROM sectors WHERE nome = 'Acabamento');

INSERT INTO sectors (nome, descricao, ativo)
SELECT 'Costura', 'Setor de costura', true
WHERE NOT EXISTS (SELECT 1 FROM sectors WHERE nome = 'Costura');

INSERT INTO sectors (nome, descricao, ativo)
SELECT 'Manutenção', 'Setor de manutenção', true
WHERE NOT EXISTS (SELECT 1 FROM sectors WHERE nome = 'Manutenção');

INSERT INTO sectors (nome, descricao, ativo)
SELECT 'Administrativo', 'Setor administrativo', true
WHERE NOT EXISTS (SELECT 1 FROM sectors WHERE nome = 'Administrativo');

-- Permissões padrão
INSERT INTO permissions (role, permissions)
SELECT 'Gestor do Sistema', '["all"]'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE role = 'Gestor do Sistema');

INSERT INTO permissions (role, permissions)
SELECT 'Encarregado', '["newRequest", "myRequests", "sectorHistory", "sectorPDFs", "uploadPDF"]'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE role = 'Encarregado');

INSERT INTO permissions (role, permissions)
SELECT 'Mecânico', '["requests", "partRequests", "agulhas", "maintenance"]'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE role = 'Mecânico');

INSERT INTO permissions (role, permissions)
SELECT 'Tecelão', '["newRequest", "myRequests", "agulhas", "sectorPDFs"]'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE role = 'Tecelão');

-- ==========================================
-- CRIAR FUNÇÕES E TRIGGERS
-- ==========================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover triggers existentes se houver (para evitar duplicação)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_sectors_updated_at ON sectors;
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
DROP TRIGGER IF EXISTS update_parts_requests_updated_at ON parts_requests;
DROP TRIGGER IF EXISTS update_permissions_updated_at ON permissions;

-- Criar triggers
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
-- VERIFICAÇÃO FINAL
-- ==========================================

-- Mostrar quantas tabelas foram criadas
SELECT 
  'Tabelas criadas com sucesso!' as status,
  COUNT(*) as total_tabelas
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'sectors', 'assets', 'requests', 'agulhas', 'pdfs', 'parts_requests', 'notifications', 'permissions', 'system_data');

-- Mostrar dados iniciais
SELECT 'Usuários:' as tipo, COUNT(*) as total FROM users
UNION ALL
SELECT 'Setores:', COUNT(*) FROM sectors
UNION ALL
SELECT 'Permissões:', COUNT(*) FROM permissions;

-- ==========================================
-- FIM DA MIGRAÇÃO
-- ==========================================

