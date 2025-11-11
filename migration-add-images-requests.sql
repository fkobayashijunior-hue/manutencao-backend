-- Adicionar campo de imagens nas solicitações de manutenção
-- Sistema Aza Connect

-- Adicionar coluna images na tabela requests (armazena array de URLs das imagens)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS images TEXT;

-- Verificar alteração
DESCRIBE requests;

