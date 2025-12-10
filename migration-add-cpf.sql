-- =====================================================
-- MIGRATION: Adicionar campo CPF na tabela users
-- Data: 09/12/2025
-- Descrição: Adiciona coluna cpf na tabela users para
--            uso em assinaturas digitais e identificação
-- =====================================================

-- Adicionar coluna CPF na tabela users
ALTER TABLE users 
ADD COLUMN cpf VARCHAR(14) NULL AFTER email;

-- Criar índice para busca rápida por CPF
CREATE INDEX idx_users_cpf ON users(cpf);

-- Verificar estrutura atualizada
DESCRIBE users;
