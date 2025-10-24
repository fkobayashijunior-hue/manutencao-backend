-- Tabela para agendamento de manutenções preventivas
CREATE TABLE IF NOT EXISTS preventive_maintenance_schedule (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  equipment_name VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  scheduled_date DATE NOT NULL,
  frequency_days INT DEFAULT 90,
  status ENUM('Pendente', 'Em Andamento', 'Concluída', 'Cancelada') DEFAULT 'Pendente',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  completed_by VARCHAR(255),
  notes TEXT,
  INDEX idx_scheduled_date (scheduled_date),
  INDEX idx_status (status),
  INDEX idx_equipment (equipment_id)
);

-- Tabela para checklist de manutenção preventiva
CREATE TABLE IF NOT EXISTS preventive_maintenance_checklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  maintenance_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_order INT DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  observations TEXT,
  completed_by VARCHAR(255),
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (maintenance_id) REFERENCES preventive_maintenance_schedule(id) ON DELETE CASCADE,
  INDEX idx_maintenance (maintenance_id)
);

-- Tabela para histórico de manutenções preventivas
CREATE TABLE IF NOT EXISTS preventive_maintenance_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipment_id INT NOT NULL,
  equipment_name VARCHAR(255) NOT NULL,
  maintenance_date DATE NOT NULL,
  performed_by VARCHAR(255),
  checklist_summary JSON,
  general_observations TEXT,
  next_maintenance_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_equipment_history (equipment_id),
  INDEX idx_maintenance_date (maintenance_date)
);

-- Inserir itens padrão do checklist (template)
CREATE TABLE IF NOT EXISTS checklist_template (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  item_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir itens do checklist padrão
INSERT INTO checklist_template (item_name, item_order) VALUES
('Verificar óleo', 1),
('Limpar válvula de sucção', 2),
('Limpar capa de platinas', 3),
('Limpar aro do cilindro', 4),
('Limpar e trocar as graxas das engrenagens', 5),
('Limpar placas de pistões', 6),
('Regular aro platinas', 7),
('Conferir borrachinha', 8),
('Conferir todos sensores', 9),
('Conferir pontos', 10)
ON DUPLICATE KEY UPDATE item_name = item_name;

