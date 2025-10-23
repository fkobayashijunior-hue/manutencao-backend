-- Migration: Adicionar coluna images na tabela parts_requests
-- Data: 2025-10-22
-- Descrição: Permite anexar múltiplas imagens nas solicitações de peças

ALTER TABLE parts_requests ADD COLUMN IF NOT EXISTS images TEXT;

-- Comentário da coluna
COMMENT ON COLUMN parts_requests.images IS 'JSON array de URLs de imagens anexadas';

