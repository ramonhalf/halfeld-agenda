-- ===== TABELA ASSINATURAS =====

CREATE TABLE IF NOT EXISTS assinaturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    nome_plano TEXT NOT NULL,
    servicos_incluidos TEXT, -- JSON array de serviços
    creditos_total INTEGER NOT NULL DEFAULT 4,
    creditos_usados INTEGER NOT NULL DEFAULT 0,
    validade_dias INTEGER NOT NULL DEFAULT 30,
    data_inicio DATE NOT NULL,
    data_fim DATE, -- Calculado: data_inicio + validade_dias
    valor_total REAL NOT NULL,
    status_pagamento TEXT NOT NULL DEFAULT 'pendente', -- pendente, pago
    ativo INTEGER NOT NULL DEFAULT 1, -- 1 = ativo, 0 = cancelado
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_cliente ON assinaturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_ativo ON assinaturas(ativo);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status_pagamento);

-- Trigger para atualizar data_fim automaticamente
CREATE TRIGGER IF NOT EXISTS update_assinatura_data_fim
AFTER INSERT ON assinaturas
BEGIN
    UPDATE assinaturas 
    SET data_fim = date(NEW.data_inicio, '+' || NEW.validade_dias || ' days')
    WHERE id = NEW.id;
END;

-- Trigger para updated_at
CREATE TRIGGER IF NOT EXISTS update_assinatura_timestamp
AFTER UPDATE ON assinaturas
BEGIN
    UPDATE assinaturas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
