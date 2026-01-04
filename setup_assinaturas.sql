-- ================================================
-- HALFELD PETCARE - SISTEMA DE ASSINATURAS V2
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ================================================

-- FASE 1: Criar tabela de assinaturas
CREATE TABLE IF NOT EXISTS assinaturas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES tutores(id),
    nome_plano TEXT NOT NULL,
    pets_ids JSONB,              -- [1, 2, 3] ou "todos"
    servicos_incluidos JSONB,    -- [{id, nome}]
    
    -- Créditos
    creditos_total INTEGER NOT NULL DEFAULT 4,
    creditos_usados INTEGER NOT NULL DEFAULT 0,
    
    -- Pagamento
    valor_total REAL NOT NULL DEFAULT 0,
    pago INTEGER NOT NULL DEFAULT 0,
    forma_pagamento TEXT,
    
    -- Datas
    data_ultimo_pagamento TIMESTAMP,
    
    -- Status
    ativo INTEGER NOT NULL DEFAULT 1,
    observacoes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FASE 2: Vincular agendamentos às assinaturas
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS assinatura_id INTEGER REFERENCES assinaturas(id);

-- FASE 3: Adicionar campo para taxi sem custo (se não existir)
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS taxi_sem_custo BOOLEAN DEFAULT FALSE;

-- Verificar criação
SELECT 'Tabela assinaturas criada com sucesso!' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assinaturas' 
ORDER BY ordinal_position;
