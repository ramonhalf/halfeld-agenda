const { Pool } = require('pg');
const { hashPassword } = require('./auth');

// Configurao da conexo com Supabase (PostgreSQL)
// A URL deve vir da varivel de ambiente DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessrio para Supabase em alguns ambientes de deploy
    }
});

// Inicializa o banco de dados
function initDatabase() {
    return new Promise(async (resolve, reject) => {
        try {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Tabela de Categorias
                await client.query(`
                    CREATE TABLE IF NOT EXISTS categorias (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL UNIQUE,
                        cor TEXT NOT NULL,
                        ordem INTEGER NOT NULL
                    )
                `);

                // Tabela de Servios
                await client.query(`
                    CREATE TABLE IF NOT EXISTS servicos (
                        id SERIAL PRIMARY KEY,
                        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
                        nome TEXT NOT NULL,
                        preco REAL NOT NULL,
                        duracao_minutos INTEGER DEFAULT 60,
                        descricao TEXT,
                        ativo INTEGER DEFAULT 1
                    )
                `);

                // Tabela de Usurios
                // 'funcao' e 'role' eram CHECK constraints, aqui mantemos simplificado ou adicionamos CHECK
                await client.query(`
                    CREATE TABLE IF NOT EXISTS usuarios (
                        id SERIAL PRIMARY KEY,
                        username TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        nome_completo TEXT NOT NULL,
                        is_admin INTEGER DEFAULT 0,
                        role TEXT DEFAULT 'gerente',
                        funcao TEXT DEFAULT 'Operao',
                        unidade_id INTEGER,
                        ativo INTEGER DEFAULT 1,
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Tutores
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tutores (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        telefone TEXT NOT NULL,
                        endereco TEXT,
                        observacoes TEXT,
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Pets
                await client.query(`
                    CREATE TABLE IF NOT EXISTS pets (
                        id SERIAL PRIMARY KEY,
                        tutor_id INTEGER NOT NULL REFERENCES tutores(id),
                        nome TEXT NOT NULL,
                        raca TEXT NOT NULL,
                        peso REAL NOT NULL,
                        data_nascimento DATE,
                        data_proximo_vermifugo DATE,
                        historico_vermifugo TEXT DEFAULT '[]',
                        intervalo_vermifugo_meses INTEGER DEFAULT 3,
                        data_proximo_antiparasita DATE,
                        historico_antiparasita TEXT DEFAULT '[]',
                        intervalo_antiparasita_meses INTEGER DEFAULT 3,
                        observacoes TEXT,
                        ativo INTEGER DEFAULT 1,
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Agendamentos
                await client.query(`
                    CREATE TABLE IF NOT EXISTS agendamentos (
                        id SERIAL PRIMARY KEY,
                        pet_nome TEXT NOT NULL,
                        pet_id INTEGER REFERENCES pets(id),
                        data TEXT NOT NULL,
                        hora_inicio TEXT NOT NULL,
                        duracao_minutos INTEGER NOT NULL,
                        servicos TEXT NOT NULL,
                        servicos_extras TEXT DEFAULT '[]',
                        valores_customizados TEXT,
                        desconto_tipo TEXT DEFAULT 'valor',
                        desconto_valor REAL DEFAULT 0,
                        valor_total REAL DEFAULT 0,
                        pago INTEGER DEFAULT 0,
                        forma_pagamento TEXT DEFAULT NULL,
                        taxi_buscar INTEGER DEFAULT 0,
                        taxi_levar INTEGER DEFAULT 0,
                        observacoes TEXT,
                        unidade_id INTEGER DEFAULT 1 NOT NULL,
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Adicionar colunas cliente_pacote_id e sem_custo se no existirem
                await client.query(`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='agendamentos' AND column_name='cliente_pacote_id') THEN
                            ALTER TABLE agendamentos ADD COLUMN cliente_pacote_id INTEGER REFERENCES clientes_pacotes(id);
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='agendamentos' AND column_name='sem_custo') THEN
                            ALTER TABLE agendamentos ADD COLUMN sem_custo BOOLEAN DEFAULT FALSE;
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='agendamentos' AND column_name='extras_descricao') THEN
                            ALTER TABLE agendamentos ADD COLUMN extras_descricao TEXT;
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='agendamentos' AND column_name='extras_valor') THEN
                            ALTER TABLE agendamentos ADD COLUMN extras_valor REAL DEFAULT 0;
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='agendamentos' AND column_name='extras_pago') THEN
                            ALTER TABLE agendamentos ADD COLUMN extras_pago BOOLEAN DEFAULT FALSE;
                        END IF;
                    END $$;
                `);

                // Adicionar colunas à tabela assinaturas se não existirem
                await client.query(`
                    DO $$ 
                    BEGIN 
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='assinaturas' AND column_name='forma_pagamento') THEN
                            ALTER TABLE assinaturas ADD COLUMN forma_pagamento TEXT;
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                     WHERE table_name='assinaturas' AND column_name='data_ultimo_pagamento') THEN
                            ALTER TABLE assinaturas ADD COLUMN data_ultimo_pagamento TIMESTAMP;
                        END IF;
                    END $$;
                `);


                // Tabela de Lembretes
                await client.query(`
                    CREATE TABLE IF NOT EXISTS lembretes (
                        id SERIAL PRIMARY KEY,
                        pet_id INTEGER NOT NULL REFERENCES pets(id),
                        tipo TEXT NOT NULL,
                        data_evento DATE NOT NULL,
                        data_lembrete DATE NOT NULL,
                        status TEXT DEFAULT 'pendente',
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Unidades
                await client.query(`
                    CREATE TABLE IF NOT EXISTS unidades (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        endereco TEXT,
                        telefone TEXT,
                        ativa INTEGER DEFAULT 1,
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Transaes de Caixa
                await client.query(`
                    CREATE TABLE IF NOT EXISTS caixa_transacoes (
                        id SERIAL PRIMARY KEY,
                        unidade_id INTEGER NOT NULL REFERENCES unidades(id),
                        valor REAL NOT NULL,
                        categoria TEXT NOT NULL,
                        descricao TEXT NOT NULL,
                        agendamento_id INTEGER REFERENCES agendamentos(id),
                        usuario_id INTEGER REFERENCES usuarios(id),
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Templates de Mensagens WhatsApp
                await client.query(`
                    CREATE TABLE IF NOT EXISTS templates_mensagens (
                        id SERIAL PRIMARY KEY,
                        tipo TEXT NOT NULL UNIQUE,
                        template TEXT NOT NULL,
                        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Inserir templates padrão se não existirem
                await client.query(`
                    INSERT INTO templates_mensagens (tipo, template) VALUES
                    ('inativo', 'Olá {nome}! 👋 Sentimos sua falta aqui na Halfeld PetCare! Faz um tempo que não vemos {pet}. Que tal agendar um banho ou tosa? 🐾'),
                    ('aniversario', 'Feliz aniversário para {pet}! 🎂🐾 A Halfeld PetCare deseja muitos anos de alegria! Que tal comemorar com um dia de spa?'),
                    ('pagamento', 'Olá {nome}! Identificamos um pagamento pendente do atendimento de {pet}. Podemos ajudar? 💰'),
                    ('renovacao', 'Olá {nome}! O pacote de {pet} chegou ao fim! 📦 Que tal renovar para continuar aproveitando os benefícios?'),
                    ('vermifugo', 'Olá {nome}! O vermífugo de {pet} está vencendo em breve. 💊 Não esqueça de manter a saúde do seu pet em dia!'),
                    ('antiparasitario', 'Olá {nome}! O antiparasitário de {pet} precisa ser renovado. 🐜 Entre em contato para mais informações!')
                    ON CONFLICT (tipo) DO NOTHING
                `);


                // Tabela de Pacotes
                await client.query(`
                    CREATE TABLE IF NOT EXISTS pacotes (
                        id SERIAL PRIMARY KEY,
                        nome TEXT NOT NULL,
                        descricao TEXT,
                        qtd_servicos INTEGER NOT NULL,
                        valor REAL NOT NULL,
                        ativo INTEGER DEFAULT 1,
                        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Tabela de Pacotes dos Clientes
                await client.query(`
                    CREATE TABLE IF NOT EXISTS clientes_pacotes (
                        id SERIAL PRIMARY KEY,
                        tutor_id INTEGER NOT NULL REFERENCES tutores(id),
                        pacote_id INTEGER NOT NULL REFERENCES pacotes(id),
                        qtd_restante INTEGER NOT NULL,
                        pago INTEGER DEFAULT 0,
                        forma_pagamento TEXT,
                        data_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        data_validade DATE,
                        ativo INTEGER DEFAULT 1
                    )
                `);

                // Migrao para adicionar colunas se no existirem
                try {
                    await client.query('ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS cliente_pacote_id INTEGER');
                    await client.query('ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sem_custo BOOLEAN DEFAULT FALSE');
                } catch (e) {
                    console.log('Migrao de colunas agendamento: ', e.message);
                }

                // SEEDS - Unidades
                const checkUnidades = await client.query('SELECT COUNT(*) FROM unidades');
                if (parseInt(checkUnidades.rows[0].count) === 0) {
                    await client.query('INSERT INTO unidades (nome) VALUES ($1), ($2)', ['Unidade 01', 'Unidade 02']);
                    console.log('? Unidades padro criadas');
                }

                // SEEDS - Categorias
                const categorias = [
                    { nome: 'Banhos', cor: '#4F46E5', ordem: 1 },
                    { nome: 'Tosa Comercial', cor: '#7C3AED', ordem: 2 },
                    { nome: 'Tosa Avanada', cor: '#9333EA', ordem: 3 },
                    { nome: 'Tosa Especfica', cor: '#A855F7', ordem: 4 },
                    { nome: 'Cuidados Adicionais', cor: '#C084FC', ordem: 5 },
                    { nome: 'Cuidados Especiais', cor: '#D8B4FE', ordem: 6 },
                    { nome: 'Taxi Dog', cor: '#F59E0B', ordem: 7 }
                ];

                for (const cat of categorias) {
                    await client.query(
                        'INSERT INTO categorias (nome, cor, ordem) VALUES ($1, $2, $3) ON CONFLICT (nome) DO NOTHING',
                        [cat.nome, cat.cor, cat.ordem]
                    );
                }

                // SEEDS - Servios
                const checkServicos = await client.query('SELECT COUNT(*) FROM servicos');
                if (parseInt(checkServicos.rows[0].count) === 0) {
                    const servicos = [
                        // Banhos
                        { categoria: 'Banhos', nome: 'Banho Simples - Porte Pequeno', preco: 45.00, duracao: 45 },
                        { categoria: 'Banhos', nome: 'Banho Simples - Porte Mdio', preco: 60.00, duracao: 60 },
                        { categoria: 'Banhos', nome: 'Banho Simples - Porte Grande', preco: 80.00, duracao: 75 },
                        { categoria: 'Banhos', nome: 'Banho Premium - Porte Pequeno', preco: 65.00, duracao: 60 },
                        { categoria: 'Banhos', nome: 'Banho Premium - Porte Mdio', preco: 85.00, duracao: 75 },
                        { categoria: 'Banhos', nome: 'Banho Premium - Porte Grande', preco: 110.00, duracao: 90 },

                        // Tosa Comercial
                        { categoria: 'Tosa Comercial', nome: 'Tosa Comercial - Porte Pequeno', preco: 70.00, duracao: 60 },
                        { categoria: 'Tosa Comercial', nome: 'Tosa Comercial - Porte Mdio', preco: 90.00, duracao: 75 },
                        { categoria: 'Tosa Comercial', nome: 'Tosa Comercial - Porte Grande', preco: 120.00, duracao: 90 },

                        // Tosa Avanada
                        { categoria: 'Tosa Avanada', nome: 'Tosa Avanada - Porte Pequeno', preco: 90.00, duracao: 75 },
                        { categoria: 'Tosa Avanada', nome: 'Tosa Avanada - Porte Mdio', preco: 120.00, duracao: 90 },
                        { categoria: 'Tosa Avanada', nome: 'Tosa Avanada - Porte Grande', preco: 150.00, duracao: 120 },

                        // Tosa Especfica
                        { categoria: 'Tosa Especfica', nome: 'Tosa Raa Especfica - Poodle', preco: 100.00, duracao: 90 },
                        { categoria: 'Tosa Especfica', nome: 'Tosa Raa Especfica - Schnauzer', preco: 110.00, duracao: 90 },
                        { categoria: 'Tosa Especfica', nome: 'Tosa Raa Especfica - Yorkshire', preco: 95.00, duracao: 75 },

                        // Cuidados Adicionais
                        { categoria: 'Cuidados Adicionais', nome: 'Corte de Unhas', preco: 20.00, duracao: 15 },
                        { categoria: 'Cuidados Adicionais', nome: 'Limpeza de Ouvidos', preco: 25.00, duracao: 15 },
                        { categoria: 'Cuidados Adicionais', nome: 'Escovao de Dentes', preco: 30.00, duracao: 20 },
                        { categoria: 'Cuidados Adicionais', nome: 'Hidratao', preco: 40.00, duracao: 30 },

                        // Taxi Dog
                        { categoria: 'Taxi Dog', nome: 'Buscar Pet (at 5km)', preco: 15.00, duracao: 15 },
                        { categoria: 'Taxi Dog', nome: 'Levar Pet (at 5km)', preco: 15.00, duracao: 15 },
                        { categoria: 'Taxi Dog', nome: 'Buscar Pet (5-10km)', preco: 25.00, duracao: 15 },
                        { categoria: 'Taxi Dog', nome: 'Levar Pet (5-10km)', preco: 25.00, duracao: 15 }
                    ];

                    for (const serv of servicos) {
                        await client.query(`
                            INSERT INTO servicos (categoria_id, nome, preco, duracao_minutos) 
                            VALUES ((SELECT id FROM categorias WHERE nome = $1), $2, $3, $4)
                        `, [serv.categoria, serv.nome, serv.preco, serv.duracao]);
                    }
                    console.log('? Servios padro inseridos');
                }

                // SEEDS - Usurio Admin
                const checkUsers = await client.query('SELECT COUNT(*) FROM usuarios');
                if (parseInt(checkUsers.rows[0].count) === 0) {
                    const hash = await hashPassword('halfeld2025');
                    await client.query(
                        'INSERT INTO usuarios (username, password_hash, nome_completo, is_admin, role, funcao) VALUES ($1, $2, $3, $4, $5, $6)',
                        ['admin', hash, 'Administrador', 1, 'admin', 'Admin']
                    );
                    console.log('? Usurio admin criado - Login: admin / Senha: halfeld2025');
                }

                await client.query('COMMIT');
                console.log('? Banco de dados inicializado com sucesso (PostgreSQL)!');
                resolve();

            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao conectar ou inicializar DB:', error);
            reject(error);
        }
    });
}

// Funes CRUD

async function getCategorias() {
    const result = await pool.query('SELECT * FROM categorias ORDER BY ordem');
    return result.rows;
}

async function getServicos() {
    const result = await pool.query(`
        SELECT s.*, c.nome as categoria_nome, c.cor as categoria_cor
        FROM servicos s
        JOIN categorias c ON s.categoria_id = c.id
        WHERE s.ativo = 1
        ORDER BY c.ordem, s.nome
    `);
    return result.rows;
}

async function getServicosPorCategoria() {
    // Ateno: PostgreSQL tem syntax JSON diferente para agrupamento
    // Usando json_agg e json_build_object
    const result = await pool.query(`
        SELECT c.id, c.nome, c.cor, c.ordem,
               json_agg(
                 json_build_object(
                   'id', s.id,
                   'nome', s.nome,
                   'preco', s.preco,
                   'duracao_minutos', s.duracao_minutos,
                   'descricao', s.descricao
                 ) ORDER BY s.nome
               ) FILTER (WHERE s.id IS NOT NULL) as servicos
        FROM categorias c
        LEFT JOIN servicos s ON c.id = s.categoria_id AND s.ativo = 1
        GROUP BY c.id, c.nome, c.cor, c.ordem
        ORDER BY c.ordem
    `);

    // Postgres retorna null se o FILTER excluir tudo, mas aqui o LEFT JOIN j filtra
    // Se no tiver servios, retorna null no json_agg ou array vazio dependendo da verso
    // Tratamento no JS:
    return result.rows.map(row => ({
        ...row,
        servicos: row.servicos || []
    }));
}

async function updatePreco(servicoId, novoPreco) {
    await pool.query('UPDATE servicos SET preco = $1 WHERE id = $2', [novoPreco, servicoId]);
    return { id: servicoId, preco: novoPreco };
}

async function updateServico(servicoId, updates) {
    const { nome, preco, duracao_minutos } = updates;
    await pool.query(
        'UPDATE servicos SET nome = $1, preco = $2, duracao_minutos = $3 WHERE id = $4',
        [nome, preco, duracao_minutos, servicoId]
    );
    return { id: servicoId, ...updates };
}

async function addServico(categoriaId, nome, preco, duracaoMinutos, descricao) {
    const result = await pool.query(
        'INSERT INTO servicos (categoria_id, nome, preco, duracao_minutos, descricao) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [categoriaId, nome, preco, duracaoMinutos, descricao]
    );
    return { id: result.rows[0].id };
}

// Agendamentos

async function getAgendamentos(data = null, unidadeId = null) {
    let query = `
        SELECT a.*, 
               a.pet_id as pet_id,
               t.nome as tutor_nome, 
               t.telefone as tutor_telefone, 
               t.endereco as tutor_endereco
        FROM agendamentos a
        LEFT JOIN pets p ON a.pet_id IS NOT NULL AND a.pet_id = p.id
        LEFT JOIN tutores t ON p.tutor_id = t.id
        WHERE 1=1
    `;
    let params = [];
    let paramCount = 1;

    if (data) {
        query += ` AND a.data = $${paramCount}`;
        params.push(data);
        paramCount++;
    }

    if (unidadeId) {
        query += ` AND a.unidade_id = $${paramCount}`;
        params.push(unidadeId);
        paramCount++;
    }

    query += ' ORDER BY a.data, a.hora_inicio';

    const result = await pool.query(query, params);

    return result.rows.map(row => ({
        ...row,
        servicos: JSON.parse(row.servicos || '[]'),
        servicos_extras: JSON.parse(row.servicos_extras || '[]'),
        valores_customizados: JSON.parse(row.valores_customizados || '{}'),
        taxi_buscar: Boolean(row.taxi_buscar),
        taxi_levar: Boolean(row.taxi_levar),
        pago: Boolean(row.pago)
    }));
}

async function getAgendamentoById(id) {
    const result = await pool.query('SELECT * FROM agendamentos WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) return null;

    return {
        ...row,
        servicos: JSON.parse(row.servicos || '[]'),
        servicos_extras: JSON.parse(row.servicos_extras || '[]'),
        valores_customizados: JSON.parse(row.valores_customizados || '{}'),
        taxi_buscar: Boolean(row.taxi_buscar),
        taxi_levar: Boolean(row.taxi_levar),
        pago: Boolean(row.pago)
    };
}

async function createAgendamento(agendamento) {
    const { pet_nome, pet_id, data, hora_inicio, duracao_minutos, servicos, servicos_extras, valores_customizados, desconto_tipo, desconto_valor, valor_total, pago, taxi_buscar, taxi_levar, observacoes, unidade_id, cliente_pacote_id, sem_custo, assinatura_id } = agendamento;

    const result = await pool.query(
        `INSERT INTO agendamentos (pet_nome, pet_id, data, hora_inicio, duracao_minutos, servicos, servicos_extras, valores_customizados, desconto_tipo, desconto_valor, valor_total, pago, taxi_buscar, taxi_levar, observacoes, unidade_id, cliente_pacote_id, sem_custo, assinatura_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id`,
        [
            pet_nome,
            pet_id || null,
            data,
            hora_inicio,
            duracao_minutos,
            JSON.stringify(servicos),
            JSON.stringify(servicos_extras || []),
            JSON.stringify(valores_customizados || {}),
            desconto_tipo || 'valor',
            desconto_valor || 0,
            valor_total || 0,
            pago ? 1 : 0,
            taxi_buscar ? 1 : 0,
            taxi_levar ? 1 : 0,
            observacoes,
            unidade_id || 1,
            cliente_pacote_id || null,
            sem_custo ? true : false,
            assinatura_id || null
        ]
    );

    return { id: result.rows[0].id, ...agendamento };
}

async function updateAgendamento(id, agendamento) {
    const { pet_nome, data, hora_inicio, duracao_minutos, servicos, servicos_extras, valores_customizados, desconto_tipo, desconto_valor, valor_total, pago, forma_pagamento, taxi_buscar, taxi_levar, observacoes, cliente_pacote_id, sem_custo } = agendamento;

    await pool.query(
        `UPDATE agendamentos 
         SET pet_nome = $1, data = $2, hora_inicio = $3, duracao_minutos = $4, servicos = $5, servicos_extras = $6, valores_customizados = $7, desconto_tipo = $8, desconto_valor = $9, valor_total = $10, pago = $11, forma_pagamento = $12,
             taxi_buscar = $13, taxi_levar = $14, observacoes = $15, cliente_pacote_id = $16, sem_custo = $17, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $18`,
        [
            pet_nome,
            data,
            hora_inicio,
            duracao_minutos,
            JSON.stringify(servicos),
            JSON.stringify(servicos_extras || []),
            JSON.stringify(valores_customizados || {}),
            desconto_tipo || 'valor',
            desconto_valor || 0,
            valor_total || 0,
            pago ? 1 : 0,
            forma_pagamento || null,
            taxi_buscar ? 1 : 0,
            taxi_levar ? 1 : 0,
            observacoes,
            cliente_pacote_id || null,
            sem_custo ? true : false,
            id
        ]
    );
    return { id, ...agendamento };
}

async function getAgendamentoById(id) {
    const result = await pool.query('SELECT * FROM agendamentos WHERE id = $1', [id]);
    return result.rows[0];
}

async function getAgendamentosByAssinatura(assinaturaId) {
    const result = await pool.query(
        'SELECT * FROM agendamentos WHERE assinatura_id = $1 ORDER BY data ASC, hora_inicio ASC',
        [assinaturaId]
    );
    return result.rows;
}

async function deleteAgendamento(id) {
    const result = await pool.query('DELETE FROM agendamentos WHERE id = $1', [id]);
    return { deleted: result.rowCount > 0 };
}

async function deleteServico(id) {
    const result = await pool.query('DELETE FROM servicos WHERE id = $1', [id]);
    return { deleted: result.rowCount > 0 };
}

// Usurios

async function getUsuarioByUsername(username) {
    // Busca case-insensitive
    const result = await pool.query('SELECT * FROM usuarios WHERE LOWER(username) = LOWER($1) AND ativo = 1', [username]);
    return result.rows[0] || null;
}

async function getUsuarioById(id) {
    const result = await pool.query('SELECT id, username, nome_completo, role, funcao, unidade_id, ativo, criado_em FROM usuarios WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function createUsuario(username, password, nomeCompleto, role = 'gerente', funcao = 'Operao', unidadeId = null) {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
        'INSERT INTO usuarios (username, password_hash, nome_completo, role, funcao, unidade_id, is_admin) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [username, passwordHash, nomeCompleto, role, funcao, role === 'admin' ? null : unidadeId, role === 'admin' ? 1 : 0]
    );
    return { id: result.rows[0].id, username, nome_completo: nomeCompleto, role, funcao, unidade_id: unidadeId };
}

async function updateUsuarioPassword(userId, newPassword) {
    const passwordHash = await hashPassword(newPassword);
    const result = await pool.query(
        'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
        [passwordHash, userId]
    );
    return { success: result.rowCount > 0 };
}

async function getAllUsuarios() {
    const result = await pool.query('SELECT id, username, nome_completo, role, funcao, unidade_id, ativo, criado_em FROM usuarios ORDER BY nome_completo');
    return result.rows;
}

async function updateUsuario(id, updates) {
    const { nome_completo, role, funcao, unidade_id } = updates;
    const result = await pool.query(
        'UPDATE usuarios SET nome_completo = $1, role = $2, funcao = $3, unidade_id = $4 WHERE id = $5',
        [nome_completo, role, funcao, unidade_id, id]
    );
    return { id, changes: result.rowCount };
}

async function updateUsuarioStatus(id, ativo) {
    const result = await pool.query(
        'UPDATE usuarios SET ativo = $1 WHERE id = $2',
        [ativo ? 1 : 0, id]
    );
    return { id, ativo, changes: result.rowCount };
}

async function deleteUsuario(id) {
    const result = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    return { deleted: result.rowCount > 0 };
}

// Unidades

async function getAllUnidades() {
    // Ordem por nome para ser mais user friendly, ou ID
    const result = await pool.query('SELECT * FROM unidades WHERE ativa = 1 ORDER BY id');
    return result.rows;
}

// Tutores

async function createTutor(tutor) {
    const result = await pool.query(
        'INSERT INTO tutores (nome, telefone, endereco, observacoes) VALUES ($1, $2, $3, $4) RETURNING id',
        [tutor.nome, tutor.telefone, tutor.endereco || '', tutor.observacoes || '']
    );
    return { id: result.rows[0].id };
}

async function getTutorById(id) {
    const result = await pool.query('SELECT * FROM tutores WHERE id = $1', [id]);
    return result.rows[0];
}

async function getAllTutores() {
    const result = await pool.query('SELECT * FROM tutores ORDER BY nome');
    return result.rows;
}

async function searchTutores(query) {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
        'SELECT * FROM tutores WHERE nome ILIKE $1 OR telefone ILIKE $2 ORDER BY nome LIMIT 20',
        [searchTerm, searchTerm]
    );
    return result.rows;
}

async function updateTutor(id, tutor) {
    const result = await pool.query(
        `UPDATE tutores SET 
            nome = $1, 
            telefone = $2, 
            endereco = $3, 
            observacoes = $4,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $5`,
        [tutor.nome, tutor.telefone, tutor.endereco || '', tutor.observacoes || '', id]
    );
    return { success: result.rowCount > 0 };
}

async function deleteTutor(id) {
    const result = await pool.query('DELETE FROM tutores WHERE id = $1', [id]);
    return { success: result.rowCount > 0 };
}

// Pets

async function createPet(pet) {
    const result = await pool.query(
        `INSERT INTO pets (
            tutor_id, nome, raca, peso, data_nascimento, 
            data_proximo_vermifugo, historico_vermifugo, intervalo_vermifugo_meses,
            data_proximo_antiparasita, historico_antiparasita, intervalo_antiparasita_meses,
            observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
            pet.tutor_id, pet.nome, pet.raca, pet.peso,
            pet.data_nascimento || null,
            pet.data_proximo_vermifugo || null,
            JSON.stringify(pet.historico_vermifugo || []),
            pet.intervalo_vermifugo_meses || 3,
            pet.data_proximo_antiparasita || null,
            JSON.stringify(pet.historico_antiparasita || []),
            pet.intervalo_antiparasita_meses || 3,
            pet.observacoes || ''
        ]
    );
    return { id: result.rows[0].id };
}

async function getPetById(id) {
    const result = await pool.query(
        `SELECT p.*, t.nome as tutor_nome, t.telefone as tutor_telefone, t.endereco as tutor_endereco
         FROM pets p
         JOIN tutores t ON p.tutor_id = t.id
         WHERE p.id = $1`,
        [id]
    );
    const row = result.rows[0];
    if (row && row.historico_vermifugo) {
        row.historico_vermifugo = JSON.parse(row.historico_vermifugo);
    }
    return row;
}

async function getPetsByTutorId(tutorId) {
    const result = await pool.query(
        'SELECT * FROM pets WHERE tutor_id = $1 AND ativo = 1 ORDER BY nome',
        [tutorId]
    );
    return result.rows.map(row => ({
        ...row,
        historico_vermifugo: row.historico_vermifugo ? JSON.parse(row.historico_vermifugo) : []
    }));
}

async function getAllPets() {
    const result = await pool.query(
        `SELECT p.*, t.nome as tutor_nome, t.telefone as tutor_telefone
         FROM pets p
         JOIN tutores t ON p.tutor_id = t.id
         WHERE p.ativo = 1
         ORDER BY p.nome`
    );
    return result.rows.map(row => ({
        ...row,
        historico_vermifugo: row.historico_vermifugo ? JSON.parse(row.historico_vermifugo) : []
    }));
}

async function searchPetsAutocomplete(query) {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
        `SELECT p.id, p.nome, p.tutor_id, COALESCE(t.nome, 'Sem tutor') as tutor_nome, t.telefone, t.endereco
         FROM pets p
         LEFT JOIN tutores t ON p.tutor_id = t.id
         WHERE p.nome ILIKE $1 AND p.ativo = 1
         ORDER BY p.nome
         LIMIT 10`,
        [searchTerm]
    );
    return result.rows;
}

async function updatePet(id, pet) {
    const result = await pool.query(
        `UPDATE pets SET 
            nome = $1, 
            raca = $2, 
            peso = $3, 
            data_nascimento = $4, 
            data_proximo_vermifugo = $5,
            historico_vermifugo = $6,
            intervalo_vermifugo_meses = $7,
            data_proximo_antiparasita = $8,
            historico_antiparasita = $9,
            intervalo_antiparasita_meses = $10,
            observacoes = $11,
            atualizado_em = CURRENT_TIMESTAMP
        WHERE id = $12`,
        [
            pet.nome,
            pet.raca,
            pet.peso,
            pet.data_nascimento || null,
            pet.data_proximo_vermifugo || null,
            JSON.stringify(pet.historico_vermifugo || []),
            pet.intervalo_vermifugo_meses || 3,
            pet.data_proximo_antiparasita || null,
            JSON.stringify(pet.historico_antiparasita || []),
            pet.intervalo_antiparasita_meses || 3,
            pet.observacoes || '',
            id
        ]
    );
    return { success: result.rowCount > 0 };
}

async function deactivatePet(id) {
    const result = await pool.query(
        'UPDATE pets SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
    );
    return { success: result.rowCount > 0 };
}

// Lembretes

async function createLembrete(lembrete) {
    const result = await pool.query(
        'INSERT INTO lembretes (pet_id, tipo, data_evento, data_lembrete) VALUES ($1, $2, $3, $4) RETURNING id',
        [lembrete.pet_id, lembrete.tipo, lembrete.data_evento, lembrete.data_lembrete]
    );
    return { id: result.rows[0].id };
}

async function getLembretesPendentes() {
    const hoje = new Date().toISOString().split('T')[0];
    const result = await pool.query(
        `SELECT l.*, p.nome as pet_nome, p.tutor_id, t.nome as tutor_nome, t.telefone
         FROM lembretes l
         JOIN pets p ON l.pet_id = p.id
         JOIN tutores t ON p.tutor_id = t.id
         WHERE l.data_lembrete <= $1 AND l.status = 'pendente'
         ORDER BY l.data_evento`,
        [hoje]
    );
    return result.rows;
}

async function updateLembreteStatus(id, status) {
    const result = await pool.query(
        'UPDATE lembretes SET status = $1 WHERE id = $2',
        [status, id]
    );
    return { success: result.rowCount > 0 };
}

async function adiarLembrete(id) {
    // Adiar para daqui 1 dia
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataAmanha = amanha.toISOString().split('T')[0];

    const result = await pool.query(
        'UPDATE lembretes SET data_lembrete = $1, status = \'pendente\' WHERE id = $2',
        [dataAmanha, id]
    );
    return { success: result.rowCount > 0 };
}

// Funes Auxiliares: Lembretes automticos

async function verificarECriarLembretes() {
    // Esta funo agora  chamada periodicamente ou manualmente
    const hoje = new Date();
    const seteDias = new Date(hoje);
    seteDias.setDate(hoje.getDate() + 7);

    const dataHoje = hoje.toISOString().split('T')[0];
    const dataSeteDias = seteDias.toISOString().split('T')[0];

    // Verificar aniversrios (usando TO_CHAR para extrair ms-dia)
    const aniversariantes = await pool.query(
        `SELECT id, nome, data_nascimento FROM pets 
         WHERE ativo = 1 
         AND TO_CHAR(data_nascimento, 'MM-DD') BETWEEN TO_CHAR($1::date, 'MM-DD') AND TO_CHAR($2::date, 'MM-DD')`,
        [dataHoje, dataSeteDias]
    );

    for (const pet of aniversariantes.rows) {
        // Verificar se j existe
        const existing = await pool.query(
            "SELECT id FROM lembretes WHERE pet_id = $1 AND tipo = 'aniversario' AND status = 'pendente'",
            [pet.id]
        );
        if (existing.rowCount === 0) {
            const dataAniversario = new Date(pet.data_nascimento);
            dataAniversario.setFullYear(hoje.getFullYear());
            const dataLembrete = new Date(dataAniversario);
            dataLembrete.setDate(dataLembrete.getDate() - 7);

            await createLembrete({
                pet_id: pet.id,
                tipo: 'aniversario',
                data_evento: dataAniversario.toISOString().split('T')[0],
                data_lembrete: dataLembrete.toISOString().split('T')[0]
            });
        }
    }

    // Vermfugos
    const vermifugos = await pool.query(
        `SELECT id, nome, data_proximo_vermifugo FROM pets 
         WHERE ativo = 1 AND data_proximo_vermifugo BETWEEN $1 AND $2`,
        [dataHoje, dataSeteDias]
    );

    for (const pet of vermifugos.rows) {
        const existing = await pool.query(
            "SELECT id FROM lembretes WHERE pet_id = $1 AND tipo = 'vermifugo' AND status = 'pendente'",
            [pet.id]
        );
        if (existing.rowCount === 0) {
            const dataVermifugo = new Date(pet.data_proximo_vermifugo);
            const dataLembrete = new Date(dataVermifugo);
            dataLembrete.setDate(dataLembrete.getDate() - 7);

            await createLembrete({
                pet_id: pet.id,
                tipo: 'vermifugo',
                data_evento: pet.data_proximo_vermifugo,
                data_lembrete: dataLembrete.toISOString().split('T')[0]
            });
        }
    }

    // Antiparasitas
    const antiparasitas = await pool.query(
        `SELECT id, nome, data_proximo_antiparasita FROM pets 
         WHERE ativo = 1 AND data_proximo_antiparasita BETWEEN $1 AND $2`,
        [dataHoje, dataSeteDias]
    );

    for (const pet of antiparasitas.rows) {
        const existing = await pool.query(
            "SELECT id FROM lembretes WHERE pet_id = $1 AND tipo = 'antiparasita' AND status = 'pendente'",
            [pet.id]
        );
        if (existing.rowCount === 0) {
            const dataAntiparasita = new Date(pet.data_proximo_antiparasita);
            const dataLembrete = new Date(dataAntiparasita);
            dataLembrete.setDate(dataLembrete.getDate() - 7);

            await createLembrete({
                pet_id: pet.id,
                tipo: 'antiparasita',
                data_evento: pet.data_proximo_antiparasita,
                data_lembrete: dataLembrete.toISOString().split('T')[0]
            });
        }
    }

    return { success: true };
}


// Relatrios Financeiros

async function getRelatorioFinanceiroDiario(data, unidadeId = null) {
    let query = 'SELECT * FROM agendamentos WHERE data = $1';
    let params = [data];
    let count = 2;

    if (unidadeId !== null) {
        query += ` AND unidade_id = $${count}`;
        params.push(unidadeId);
    }

    query += ' ORDER BY hora_inicio';

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
        ...row,
        servicos: JSON.parse(row.servicos || '[]'),
        servicos_extras: JSON.parse(row.servicos_extras || '[]'),
        valores_customizados: JSON.parse(row.valores_customizados || '{}')
    }));
}

async function getRelatorioFinanceiroMensal(ano, mes, unidadeId = null) {
    const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
    // ltimo dia do ms: 'YYYY-MM-DD'
    // Postgres pode comparar strings date YYYY-MM-DD ok
    // Para pegar ltimo dia em JS:
    const ultimoDiaDate = new Date(ano, mes, 0).getDate();
    const ultimaData = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDiaDate}`;

    let query = 'SELECT * FROM agendamentos WHERE data BETWEEN $1 AND $2';
    let params = [primeiroDia, ultimaData];
    let count = 3;

    if (unidadeId !== null) {
        query += ` AND unidade_id = $${count}`;
        params.push(unidadeId);
    }

    query += ' ORDER BY data, hora_inicio';

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
        ...row,
        servicos: JSON.parse(row.servicos || '[]'),
        servicos_extras: JSON.parse(row.servicos_extras || '[]'),
        valores_customizados: JSON.parse(row.valores_customizados || '{}')
    }));
}

async function getRelatorioFinanceiroAnual(ano, unidadeId = null) {
    const primeiroDia = `${ano}-01-01`;
    const ultimaData = `${ano}-12-31`;

    let query = 'SELECT * FROM agendamentos WHERE data BETWEEN $1 AND $2';
    let params = [primeiroDia, ultimaData];
    let count = 3;

    if (unidadeId !== null) {
        query += ` AND unidade_id = $${count}`;
        params.push(unidadeId);
    }

    query += ' ORDER BY data, hora_inicio';

    const result = await pool.query(query, params);
    return result.rows.map(row => ({
        ...row,
        servicos: JSON.parse(row.servicos || '[]'),
        servicos_extras: JSON.parse(row.servicos_extras || '[]'),
        valores_customizados: JSON.parse(row.valores_customizados || '{}')
    }));
}

// Caixa

async function addCaixaTransacao(transacao) {
    const { unidade_id, valor, categoria, descricao, agendamento_id, usuario_id } = transacao;
    const result = await pool.query(
        'INSERT INTO caixa_transacoes (unidade_id, valor, categoria, descricao, agendamento_id, usuario_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, criado_em',
        [unidade_id, valor, categoria, descricao, agendamento_id || null, usuario_id || null]
    );
    return { id: result.rows[0].id, ...transacao, criado_em: result.rows[0].criado_em };
}

async function getCaixaSaldo(unidadeId) {
    const result = await pool.query(
        'SELECT SUM(valor) as saldo FROM caixa_transacoes WHERE unidade_id = $1',
        [unidadeId]
    );
    return result.rows[0].saldo || 0;
}

async function getCaixaExtrato(unidadeId, limit = 50) {
    const result = await pool.query(
        `SELECT t.*, u.username as usuario_nome, a.pet_nome 
         FROM caixa_transacoes t
         LEFT JOIN usuarios u ON t.usuario_id = u.id
         LEFT JOIN agendamentos a ON t.agendamento_id = a.id
         WHERE t.unidade_id = $1 
         ORDER BY t.criado_em DESC 
         LIMIT $2`,
        [unidadeId, limit]
    );
    return result.rows;
}

async function zerarCaixa(unidadeId, usuarioId) {
    // Transao para consistncia
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const resSaldo = await client.query('SELECT SUM(valor) as saldo FROM caixa_transacoes WHERE unidade_id = $1', [unidadeId]);
        const saldo = resSaldo.rows[0].saldo || 0;

        if (saldo === 0) {
            await client.query('ROLLBACK');
            return { success: true, message: 'Caixa j est zerado' };
        }

        const valorSangria = -saldo;

        await client.query(
            'INSERT INTO caixa_transacoes (unidade_id, valor, categoria, descricao, usuario_id) VALUES ($1, $2, $3, $4, $5)',
            [unidadeId, valorSangria, 'sangria', 'Fechamento/Zerar Caixa', usuarioId]
        );

        await client.query('COMMIT');
        return { success: true, valor_retirado: saldo };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function limparHistoricoCaixa(unidadeId) {
    const result = await pool.query('DELETE FROM caixa_transacoes WHERE unidade_id = $1', [unidadeId]);
    return { success: true, changes: result.rowCount };
}

// Importar Clientes Lote (Adaptao para Postgres)
async function importarClientesEmLote(dados) {
    // Processamento sequencial para no sobrecarregar pool
    let stats = { tutors: 0, pets: 0, errors: [] };

    for (const item of dados) {
        const tutor = item.tutor;
        // Transaction por cliente para consistncia
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let tutorId;
            // Verificar se tutor existe por telefone
            const resTutor = await client.query('SELECT id FROM tutores WHERE telefone = $1', [tutor.telefone]);

            if (resTutor.rows.length > 0) {
                tutorId = resTutor.rows[0].id;
            } else {
                const resNewTutor = await client.query(
                    'INSERT INTO tutores (nome, telefone, endereco, observacoes) VALUES ($1, $2, $3, $4) RETURNING id',
                    [tutor.nome, tutor.telefone, tutor.endereco, tutor.observacoes]
                );
                tutorId = resNewTutor.rows[0].id;
                stats.tutors++;
            }

            if (item.pets && item.pets.length > 0) {
                for (const pet of item.pets) {
                    await client.query(
                        `INSERT INTO pets (tutor_id, nome, raca, peso, data_nascimento, observacoes) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [tutorId, pet.nome, pet.raca, pet.peso, pet.data_nascimento, pet.observacoes]
                    );
                }
                stats.pets += item.pets.length;
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            stats.errors.push(`Erro ao importar ${tutor.nome}: ${err.message}`);
        } finally {
            client.release();
        }
    }
    return stats;
}


// Pacotes

async function getPacotes() {
    const result = await pool.query('SELECT * FROM pacotes WHERE ativo = 1 ORDER BY nome');
    return result.rows;
}

async function createPacote(pacote) {
    const result = await pool.query(
        'INSERT INTO pacotes (nome, descricao, qtd_servicos, valor, ativo) VALUES ($1, $2, $3, $4, 1) RETURNING *',
        [pacote.nome, pacote.descricao, pacote.qtd_servicos, pacote.valor]
    );
    return result.rows[0];
}

async function updatePacote(id, pacote) {
    const result = await pool.query(
        'UPDATE pacotes SET nome = $1, descricao = $2, qtd_servicos = $3, valor = $4 WHERE id = $5 RETURNING *',
        [pacote.nome, pacote.descricao, pacote.qtd_servicos, pacote.valor, id]
    );
    return result.rows[0];
}

async function deletePacote(id) {
    // Soft delete
    const result = await pool.query('UPDATE pacotes SET ativo = 0 WHERE id = $1', [id]);
    return { success: result.rowCount > 0 };
}

// Clientes Pacotes

async function getPacotesCliente(tutorId) {
    const result = await pool.query(
        `SELECT cp.*, p.nome as pacote_nome, p.descricao as pacote_descricao, p.valor, p.qtd_servicos, t.nome as tutor_nome
         FROM clientes_pacotes cp
         JOIN pacotes p ON cp.pacote_id = p.id
         JOIN tutores t ON cp.tutor_id = t.id
         WHERE cp.tutor_id = $1 AND cp.ativo = 1
         ORDER BY cp.data_compra DESC`,
        [tutorId]
    );
    return result.rows;
}

async function getTodosPacotesCliente(tutorId) {
    const result = await pool.query(
        `SELECT cp.*, p.nome as pacote_nome, p.qtd_servicos, p.valor, t.nome as tutor_nome 
         FROM clientes_pacotes cp
         JOIN pacotes p ON cp.pacote_id = p.id
         JOIN tutores t ON cp.tutor_id = t.id
         WHERE cp.tutor_id = $1
         ORDER BY cp.data_compra DESC`,
        [tutorId]
    );
    return result.rows;
}

// Obter TODOS os pacotes ativos do sistema (para lista geral)
async function getAllPacotesAtivos() {
    const result = await pool.query(
        `SELECT cp.*, p.nome as pacote_nome, p.qtd_servicos, p.valor, t.nome as tutor_nome 
         FROM clientes_pacotes cp
         JOIN pacotes p ON cp.pacote_id = p.id
         JOIN tutores t ON cp.tutor_id = t.id
         WHERE cp.ativo = 1
         ORDER BY cp.data_compra DESC`
    );
    return result.rows;
}

// Buscar usos (agendamentos) de um pacote especfico
async function getAgendamentosPorPacote(clientePacoteId) {
    const result = await pool.query(
        `SELECT 
            a.data, 
            a.hora_inicio as horario, 
            COALESCE(p.nome, a.pet_nome) as pet_nome,
            a.servicos
         FROM agendamentos a
         LEFT JOIN pets p ON a.pet_id = p.id
         WHERE a.cliente_pacote_id = $1
         ORDER BY a.data ASC, a.hora_inicio ASC`,
        [clientePacoteId]
    );

    // Processar os resultados para extrair nomes dos servios do JSON
    return result.rows.map(row => ({
        data: row.data,
        horario: row.horario,
        pet_nome: row.pet_nome,
        servico_nome: JSON.parse(row.servicos || '[]').map(s => s.nome).join(', ') || 'Servio do Pacote'
    }));
}

async function comprarPacote(venda) {
    // Venda: { tutor_id, pacote_id, qtd, valor_total, forma_pagamento, pago, userId, unidadeId }
    // Qtd de servios vem do pacote

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Buscar infos do pacote
        const resPacote = await client.query('SELECT * FROM pacotes WHERE id = $1', [venda.pacote_id]);
        if (resPacote.rows.length === 0) throw new Error('Pacote no encontrado');
        const pacote = resPacote.rows[0];

        // Calcular validade (ex: 30 dias por padro ou custom)
        // Se quiser customizvel, teria que vir na venda. Vamos por 30 dias * qtd servios
        // Ou fixo 90 dias. Vou colocar 90 dias de validade padro
        const validade = new Date();
        validade.setDate(validade.getDate() + 90);

        const result = await client.query(
            `INSERT INTO clientes_pacotes 
             (tutor_id, pacote_id, qtd_restante, pago, forma_pagamento, data_validade, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING id`,
            [
                venda.tutor_id,
                venda.pacote_id,
                pacote.qtd_servicos, // Qtd total de servios
                venda.pago ? 1 : 0,
                venda.forma_pagamento,
                validade.toISOString().split('T')[0]
            ]
        );

        // Se foi pago em dinheiro, lanar no caixa
        if (venda.pago && venda.forma_pagamento === 'dinheiro') {
            await client.query(
                'INSERT INTO caixa_transacoes (unidade_id, valor, categoria, descricao, usuario_id) VALUES ($1, $2, $3, $4, $5)',
                [venda.unidadeId, pacote.valor, 'pacote', `Venda Pacote: ${pacote.nome}`, venda.userId]
            );
        }

        await client.query('COMMIT');
        return { id: result.rows[0].id, success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function consumirCreditoPacote(clientePacoteId) {
    const result = await pool.query(
        `UPDATE clientes_pacotes 
         SET qtd_restante = qtd_restante - 1 
         WHERE id = $1 AND qtd_restante > 0 RETURNING qtd_restante`,
        [clientePacoteId]
    );

    if (result.rowCount === 0) {
        throw new Error('Sem crditos ou pacote no encontrado');
    }

    // Se zerou, pode marcar como inativo se quiser, mas a query do GET j filtra qtd_restante > 0

    return { success: true, restante: result.rows[0].qtd_restante };
}

// V2 Functions for Packages (avoiding replace issues)
async function createAgendamentoV2(agendamento) {
    const { pet_nome, pet_id, data, hora_inicio, duracao_minutos, servicos, servicos_extras, valores_customizados, desconto_tipo, desconto_valor, valor_total, pago, taxi_buscar, taxi_levar, observacoes, unidade_id, cliente_pacote_id, sem_custo } = agendamento;

    const result = await pool.query(
        `INSERT INTO agendamentos (pet_nome, pet_id, data, hora_inicio, duracao_minutos, servicos, servicos_extras, valores_customizados, desconto_tipo, desconto_valor, valor_total, pago, taxi_buscar, taxi_levar, observacoes, unidade_id, cliente_pacote_id, sem_custo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
        [
            pet_nome,
            pet_id || null,
            data,
            hora_inicio,
            duracao_minutos,
            JSON.stringify(servicos),
            JSON.stringify(servicos_extras || []),
            JSON.stringify(valores_customizados || {}),
            desconto_tipo || 'valor',
            desconto_valor || 0,
            valor_total || 0,
            pago ? 1 : 0,
            taxi_buscar ? 1 : 0,
            taxi_levar ? 1 : 0,
            observacoes,
            unidade_id || 1,
            cliente_pacote_id || null,
            sem_custo ? true : false
        ]
    );

    return {
        id: result.rows[0].id,
        ...agendamento,
        // Ensure proper parsing for return
        servicos: agendamento.servicos || [],
        servicos_extras: agendamento.servicos_extras || [],
        valores_customizados: agendamento.valores_customizados || {}
    };
}

async function updateAgendamentoV2(id, agendamento) {
    const { pet_nome, data, hora_inicio, duracao_minutos, servicos, servicos_extras, valores_customizados, desconto_tipo, desconto_valor, valor_total, pago, forma_pagamento, taxi_buscar, taxi_levar, observacoes, cliente_pacote_id, sem_custo } = agendamento;

    await pool.query(
        `UPDATE agendamentos 
         SET pet_nome = $1, data = $2, hora_inicio = $3, duracao_minutos = $4, servicos = $5, servicos_extras = $6, valores_customizados = $7, desconto_tipo = $8, desconto_valor = $9, valor_total = $10, pago = $11, forma_pagamento = $12,
             taxi_buscar = $13, taxi_levar = $14, observacoes = $15, cliente_pacote_id = $16, sem_custo = $17, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $18`,
        [
            pet_nome,
            data,
            hora_inicio,
            duracao_minutos,
            JSON.stringify(servicos),
            JSON.stringify(servicos_extras || []),
            JSON.stringify(valores_customizados || {}),
            desconto_tipo || 'valor',
            desconto_valor || 0,
            valor_total || 0,
            pago ? 1 : 0,
            forma_pagamento || null,
            taxi_buscar ? 1 : 0,
            taxi_levar ? 1 : 0,
            observacoes,
            cliente_pacote_id || null,
            sem_custo ? true : false,
            id
        ]
    );
    return { id, ...agendamento };
}

// Pagar pacote vendido a prazo
async function pagarPacote(clientePacoteId, formaPagamento, unidadeId, userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Buscar dados do pacote do cliente
        const resPacote = await client.query(
            `SELECT cp.*, p.nome as pacote_nome, p.valor 
             FROM clientes_pacotes cp
             JOIN pacotes p ON cp.pacote_id = p.id
             WHERE cp.id = $1`,
            [clientePacoteId]
        );

        if (resPacote.rows.length === 0) throw new Error('Pacote no encontrado');
        const clientePacote = resPacote.rows[0];

        if (clientePacote.pago) throw new Error('Pacote j est pago');

        // Atualizar status para pago
        await client.query(
            'UPDATE clientes_pacotes SET pago = 1, forma_pagamento = $1 WHERE id = $2',
            [formaPagamento, clientePacoteId]
        );

        // Se foi pago em dinheiro, registrar no caixa
        if (formaPagamento === 'dinheiro') {
            await client.query(
                'INSERT INTO caixa_transacoes (unidade_id, valor, categoria, descricao, usuario_id) VALUES ($1, $2, $3, $4, $5)',
                [unidadeId, clientePacote.valor, 'pacote', `Pagamento Pacote: ${clientePacote.pacote_nome}`, userId]
            );
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Cancelar pacote contratado
async function cancelarPacote(clientePacoteId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Buscar quantidade de servios do pacote original
        const resPacote = await client.query(
            `SELECT p.qtd_servicos 
             FROM clientes_pacotes cp
             JOIN pacotes p ON cp.pacote_id = p.id
             WHERE cp.id = $1`,
            [clientePacoteId]
        );

        if (resPacote.rows.length === 0) {
            throw new Error('Pacote no encontrado');
        }

        const qtdOriginal = resPacote.rows[0].qtd_servicos;

        // Marcar como inativo E resetar crditos para quantidade original
        await client.query(
            'UPDATE clientes_pacotes SET ativo = 0, qtd_restante = $1 WHERE id = $2',
            [qtdOriginal, clientePacoteId]
        );

        await client.query('COMMIT');
        return { success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// Obter movimentao do caixa (Agendamentos + Pacotes + Outros)
async function getMovimentacaoCaixa(dataInicio, dataFim, unidadeId) {
    let query = `
        SELECT * FROM caixa_transacoes 
        WHERE DATE(criado_em) BETWEEN $1 AND $2
    `;
    let params = [dataInicio, dataFim];

    if (unidadeId) {
        query += ` AND unidade_id = $3`;
        params.push(unidadeId);
    }

    query += ` ORDER BY criado_em DESC`;

    const result = await pool.query(query, params);
    return result.rows;
}

// ========== ASSINATURAS V2 ==========

async function createAssinatura(dados) {
    const { cliente_id, nome_plano, pets_ids, servicos_incluidos, creditos_total, creditos_usados, valor_total, pago, observacoes } = dados;
    const result = await pool.query(
        `INSERT INTO assinaturas (cliente_id, nome_plano, pets_ids, servicos_incluidos, creditos_total, creditos_usados, valor_total, pago, observacoes, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [cliente_id, nome_plano, pets_ids || '[]', servicos_incluidos || '[]', creditos_total || 0, creditos_usados || 0, valor_total || 0, pago ? 1 : 0, observacoes || '', 1]
    );
    return result.rows[0];
}

async function getAllAssinaturas() {
    const result = await pool.query(`
        SELECT a.*, t.nome as cliente_nome 
        FROM assinaturas a 
        LEFT JOIN tutores t ON a.cliente_id = t.id 
        WHERE a.ativo = 1 
        ORDER BY a.created_at DESC
    `);
    return result.rows;
}

async function getAssinaturaById(id) {
    const result = await pool.query(`
        SELECT a.*, t.nome as cliente_nome 
        FROM assinaturas a 
        LEFT JOIN tutores t ON a.cliente_id = t.id 
        WHERE a.id = $1
    `, [id]);
    return result.rows[0];
}

async function pagarAssinatura(id, formaPagamento) {
    const result = await pool.query(
        `UPDATE assinaturas SET pago = 1, forma_pagamento = $2, data_ultimo_pagamento = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, formaPagamento]
    );
    return result.rows[0];
}

async function cancelarPagamentoAssinatura(id) {
    const result = await pool.query(
        `UPDATE assinaturas SET pago = 0, data_ultimo_pagamento = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
    );
    return result.rows[0];
}

async function renovarAssinatura(id, creditosTotal, valorTotal) {
    const result = await pool.query(
        `UPDATE assinaturas SET creditos_total = $2, creditos_usados = 0, valor_total = $3, pago = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, creditosTotal, valorTotal]
    );
    return result.rows[0];
}

async function usarCreditoAssinatura(id) {
    const result = await pool.query(
        `UPDATE assinaturas SET creditos_usados = creditos_usados + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
    );
    return result.rows[0];
}

async function estornarCreditoAssinatura(id) {
    const result = await pool.query(
        `UPDATE assinaturas SET creditos_usados = GREATEST(creditos_usados - 1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
    );
    return result.rows[0];
}

async function cancelarAssinatura(id) {
    const result = await pool.query(
        `UPDATE assinaturas SET ativo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
    );
    return result.rows[0];
}

async function updateAssinatura(id, dados) {
    const { nome_plano, pets_ids, servicos_incluidos, creditos_total, valor_total, observacoes } = dados;
    const result = await pool.query(
        `UPDATE assinaturas SET nome_plano = $2, pets_ids = $3, servicos_incluidos = $4, creditos_total = $5, valor_total = $6, observacoes = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, nome_plano, pets_ids, servicos_incluidos, creditos_total, valor_total, observacoes]
    );
    return result.rows[0];
}

module.exports = {
    initDatabase,
    getCategorias,
    getServicos,
    getServicosPorCategoria,
    updatePreco,
    updateServico,
    addServico,
    getAgendamentos,
    getAgendamentoById,
    createAgendamento,
    updateAgendamento,
    getAgendamentoById,
    getAgendamentosByAssinatura,
    deleteAgendamento,
    deleteServico,
    getUsuarioByUsername,
    getUsuarioById,
    createUsuario,
    updateUsuarioPassword,
    getAllUsuarios,
    updateUsuario,
    updateUsuarioStatus,
    deleteUsuario,
    getAllUnidades,
    createTutor,
    getTutorById,
    getAllTutores,
    searchTutores,
    updateTutor,
    deleteTutor,
    createPet,
    getPetById,
    getPetsByTutorId,
    getAllPets,
    searchPetsAutocomplete,
    updatePet,
    deactivatePet,
    createLembrete,
    getLembretesPendentes,
    updateLembreteStatus,
    adiarLembrete,
    verificarECriarLembretes,
    getRelatorioFinanceiroDiario,
    getRelatorioFinanceiroMensal,
    getRelatorioFinanceiroAnual,
    addCaixaTransacao,
    getCaixaSaldo,
    getCaixaExtrato,
    zerarCaixa,
    limparHistoricoCaixa,
    importarClientesEmLote,
    getPacotes,
    createPacote,
    updatePacote,
    deletePacote,
    getPacotesCliente,
    getTodosPacotesCliente,
    getAllPacotesAtivos,
    getAgendamentosPorPacote,
    comprarPacote,
    consumirCreditoPacote,
    createAgendamentoV2,
    updateAgendamentoV2,
    pagarPacote,
    cancelarPacote,
    getMovimentacaoCaixa,
    // Assinaturas V2
    createAssinatura,
    getAllAssinaturas,
    getAssinaturaById,
    pagarAssinatura,
    cancelarPagamentoAssinatura,
    renovarAssinatura,
    usarCreditoAssinatura,
    estornarCreditoAssinatura,
    cancelarAssinatura,
    updateAssinatura,
    getAgendamentoById,
    getAgendamentosByAssinatura,
    // Pool para queries diretas
    pool
};
