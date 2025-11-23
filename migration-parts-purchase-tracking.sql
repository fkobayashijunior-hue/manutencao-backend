-- Migração: Adicionar campos de rastreamento de compras em parts_requests
-- Data: 2024-11-16
-- Descrição: Adiciona campos para registrar fornecedor, datas de compra e observações

ALTER TABLE parts_requests
ADD COLUMN supplier VARCHAR(255) DEFAULT NULL COMMENT 'Nome do fornecedor',
ADD COLUMN purchase_date VARCHAR(20) DEFAULT NULL COMMENT 'Data da compra (DD/MM/AAAA)',
ADD COLUMN expected_arrival_date VARCHAR(20) DEFAULT NULL COMMENT 'Data prevista de chegada (DD/MM/AAAA)',
ADD COLUMN arrival_date VARCHAR(20) DEFAULT NULL COMMENT 'Data real de chegada (DD/MM/AAAA)',
ADD COLUMN observations TEXT DEFAULT NULL COMMENT 'Observações sobre a compra (marca, preço, etc.)';

