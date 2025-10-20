-- Migration: Adicionar email e phone na tabela users
-- Data: 2025-10-18
-- Descrição: Adiciona campos de email e telefone para notificações

-- Adicionar coluna email
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Adicionar coluna phone
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Criar índice para email (para buscas rápidas)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Comentários
COMMENT ON COLUMN users.email IS 'E-mail do usuário para notificações';
COMMENT ON COLUMN users.phone IS 'Telefone do usuário para contato';

