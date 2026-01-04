-- Criar tabela de templates de mensagens
CREATE TABLE IF NOT EXISTS mensagens_templates (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- 'cliente_inativo', 'pacote_vencendo', 'creditos_restantes'
    nome VARCHAR(100) NOT NULL,
    template TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tipo)
);

-- Templates padrão
INSERT INTO mensagens_templates (tipo, nome, template) VALUES
('cliente_inativo', 'Cliente Inativo 30+ dias', 
'Olá {nome}! 👋

Sentimos sua falta aqui no Halfeld PetCare! 🐾

Faz {dias} dias que não vemos o {pet}. Que tal agendar aquele banho especial?

Temos horários disponíveis esta semana!'),

('pacote_vencendo', 'Pacote Próximo ao Vencimento',
'Olá {nome}! ⏰

Seu pacote "{pacote}" está com {creditos} créditos restantes e vence em {dias_vencimento} dias!

Não perca! Agende agora e aproveite todos os benefícios. 🐾'),

('creditos_nao_usados', 'Lembrete de Créditos',
'Olá {nome}! 💎

Você ainda tem {creditos} créditos disponíveis no pacote "{pacote}"!

Aproveite para agendar os serviços do {pet}. 🐾')

ON CONFLICT (tipo) DO NOTHING;
