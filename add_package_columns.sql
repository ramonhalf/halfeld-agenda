-- Script para adicionar colunas faltantes na tabela agendamentos
-- Execute este script diretamente no banco de dados

-- Adicionar coluna cliente_pacote_id
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agendamentos' AND column_name='cliente_pacote_id'
    ) THEN
        ALTER TABLE agendamentos ADD COLUMN cliente_pacote_id INTEGER REFERENCES clientes_pacotes(id);
        RAISE NOTICE 'Coluna cliente_pacote_id criada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna cliente_pacote_id já existe';
    END IF;
END $$;

-- Adicionar coluna sem_custo
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agendamentos' AND column_name='sem_custo'
    ) THEN
        ALTER TABLE agendamentos ADD COLUMN sem_custo BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna sem_custo criada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna sem_custo já existe';
    END IF;
END $$;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='agendamentos' 
  AND column_name IN ('cliente_pacote_id', 'sem_custo');
