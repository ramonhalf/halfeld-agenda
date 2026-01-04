require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const { verifyPassword, requireAuth, requireAdmin, requireFinanceiro, requireCreatePermission, requireClientManagement } = require('./auth');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'halfeld_dev_secret_2025';

// Configurar trust proxy para funcionar com Render.com
app.set('trust proxy', 1);

// Middleware de segurança
app.use(helmet({
    contentSecurityPolicy: false, // Desabilitar apenas para WebSocket funcionar
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://halfeld-petcare.onrender.com', 'https://halfeld-petcare-production.up.railway.app']
        : true,
    credentials: true
}));

app.use(express.json());

// Configuração de sessão
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS em produção
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Rate limiting
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000 // Limit each IP to 1000 requests per windowMs
}));

// Favicon - Silence 404
app.get('/favicon.ico', (req, res) => res.status(204).end());
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3000 // Aumentado para evitar bloqueio em uso intenso
});
app.use('/api/', apiLimiter);

// DEBUG: Log todas as requisições para /api
app.use('/api/*', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.originalUrl} - Body:`, req.body);
    next();
});

// Servir página de login sem autenticação
app.get('/login.html', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

// Servir arquivos estáticos (CSS, Logo) sem autenticação
app.use('/Logo', express.static(__dirname + '/Logo'));
app.use('/Catálogo', express.static(__dirname + '/Catálogo'));
app.get('/login.css', (req, res) => {
    res.sendFile(__dirname + '/login.css');
});

// Servir logo sem autenticação
app.get('/logo-halfeld.png', (req, res) => {
    res.sendFile(__dirname + '/logo-halfeld.png');
});

// Proteger página principal
app.get('/', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Servir imagem de background (público)
app.get('/background-feather.jpg', (req, res) => {
    res.sendFile(__dirname + '/background-feather.jpg');
});

// Servir botões personalizados (público)
app.use('/Botões', express.static(__dirname + '/Botões'));
app.use('/images', express.static(__dirname + '/images'));

// Servir outros arquivos estáticos com autenticação
app.get('/*.js', requireAuth, (req, res, next) => {
    res.sendFile(__dirname + req.path);
});

app.get('/*.css', requireAuth, (req, res, next) => {
    // Forçar navegador a nunca fazer cache do CSS
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(__dirname + req.path);
});

// Broadcast para todos os clientes WebSocket
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// WebSocket connection
wss.on('connection', (ws) => {
    console.log('✓ Cliente conectado via WebSocket');

    ws.on('close', () => {
        console.log('✗ Cliente desconectado');
    });
});

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
        }

        const usuario = await db.getUsuarioByUsername(username);

        if (!usuario) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        const senhaCorreta = await verifyPassword(password, usuario.password_hash);

        if (!senhaCorreta) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos' });
        }

        // Criar sessão com role, funcao e unidade
        req.session.userId = usuario.id;
        req.session.username = usuario.username;
        req.session.role = usuario.role || 'gerente';
        req.session.funcao = usuario.funcao || 'Operação';
        req.session.unidadeId = usuario.unidade_id;
        req.session.nomeCompleto = usuario.nome_completo;

        res.json({
            success: true,
            user: {
                id: usuario.id,
                username: usuario.username,
                nomeCompleto: usuario.nome_completo,
                role: usuario.role,
                funcao: usuario.funcao,
                unidadeId: usuario.unidade_id
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.json({ success: true });
    });
});

app.get('/api/auth/check', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                nomeCompleto: req.session.nomeCompleto,
                role: req.session.role,
                funcao: req.session.funcao,
                unidadeId: req.session.unidadeId
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Trocar senha (requer autenticação)
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Senhas são obrigatórias' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
        }

        // Verificar senha atual
        const usuario = await db.getUsuarioByUsername(req.session.username);
        const senhaCorreta = await verifyPassword(currentPassword, usuario.password_hash);

        if (!senhaCorreta) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        // Atualizar senha
        await db.updateUsuarioPassword(req.session.userId, newPassword);

        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao trocar senha:', error);
        res.status(500).json({ error: 'Erro ao trocar senha' });
    }
});

// Criar novo usuário (apenas admin)
app.post('/api/usuarios', requireAdmin, async (req, res) => {
    try {
        const { username, password, nomeCompleto, role, funcao, unidadeId } = req.body;

        if (!username || !password || !nomeCompleto || !role || !funcao) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        if (role !== 'admin' && !unidadeId) {
            return res.status(400).json({ error: 'Usuário comum deve ter unidade atribuída' });
        }

        // Criar usuário com role, funcao e unidadeID
        const usuario = await db.createUsuario(username, password, nomeCompleto, role, funcao, role === 'admin' ? null : unidadeId);

        res.status(201).json(usuario);
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Buscar usuário por ID (apenas admin) - DEVE VIR ANTES DA ROTA GENÉRICA
app.get('/api/usuarios/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await db.getUsuarioById(id);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Não enviar o hash da senha
        delete usuario.password_hash;
        res.json(usuario);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar usuários (apenas admin)
app.get('/api/usuarios', requireAdmin, async (req, res) => {
    try {
        const usuarios = await db.getAllUsuarios();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Editar usuário (apenas admin)
app.put('/api/usuarios/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nomeCompleto, role, funcao, unidadeId } = req.body;

        if (!nomeCompleto || !role || !funcao) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        // Validação: usuário comum precisa ter unidade
        if (role !== 'admin' && !unidadeId) {
            return res.status(400).json({ error: 'Usuário comum deve ter unidade atribuída' });
        }

        await db.updateUsuario(id, {
            nome_completo: nomeCompleto,
            role: role,
            funcao: funcao,
            unidade_id: role === 'admin' ? null : unidadeId
        });

        res.json({ success: true, message: 'Usuário atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Redefinir senha de usuário (apenas admin)
app.put('/api/usuarios/:id/password', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
        }

        await db.updateUsuarioPassword(id, newPassword);
        res.json({ success: true, message: 'Senha redefinida com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ativar/Desativar usuário (apenas admin)
app.patch('/api/usuarios/:id/status', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { ativo } = req.body;

        if (typeof ativo !== 'boolean') {
            return res.status(400).json({ error: 'Status inválido' });
        }

        await db.updateUsuarioStatus(id, ativo);
        res.json({ success: true, message: `Usuário ${ativo ? 'ativado' : 'desativado'} com sucesso` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excluir usuário (apenas admin)
app.delete('/api/usuarios/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Validação: não permitir excluir o próprio usuário
        if (parseInt(id) === req.session.userId) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
        }

        await db.deleteUsuario(id);
        res.json({ success: true, message: 'Usuário excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ========== ROTAS - UNIDADES ==========
app.get('/api/unidades', requireAuth, async (req, res) => {
    try {
        const unidades = await db.getAllUnidades();
        res.json(unidades);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ========== ROTAS - TUTORES ==========
app.get('/api/tutores', requireAuth, async (req, res) => {
    try {
        const { busca } = req.query;
        let tutores;
        if (busca) {
            tutores = await db.searchTutores(busca);
        } else {
            tutores = await db.getAllTutores();
        }
        res.json(tutores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - PETS ==========
app.get('/api/pets/tutor/:tutorId', requireAuth, async (req, res) => {
    try {
        const pets = await db.getPetsByTutorId(req.params.tutorId);
        res.json(pets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - CATEGORIAS (PROTEGIDAS) ==========
app.get('/api/categorias', requireAuth, async (req, res) => {
    try {
        const categorias = await db.getCategorias();
        res.json(categorias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - SERVIÇOS (PROTEGIDAS) ==========
app.get('/api/servicos', requireAuth, async (req, res) => {
    try {
        const servicos = await db.getServicos();
        res.json(servicos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/servicos/por-categoria', requireAuth, async (req, res) => {
    try {
        const servicos = await db.getServicosPorCategoria();
        res.json(servicos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/servicos/:id/preco', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { preco } = req.body;

        if (!preco || preco < 0) {
            return res.status(400).json({ error: 'Preço inválido' });
        }

        const result = await db.updatePreco(id, preco);

        // Broadcast atualização para todos os clientes
        broadcast({
            type: 'PRECO_ATUALIZADO',
            data: result
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/servicos/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, preco, duracao_minutos } = req.body;

        if (!nome || !preco || !duracao_minutos) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        const result = await db.updateServico(id, { nome, preco, duracao_minutos });

        broadcast({
            type: 'SERVICO_ATUALIZADO',
            data: result
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/servicos', requireAuth, async (req, res) => {
    try {
        const { categoria_id, nome, preco, duracao_minutos, descricao } = req.body;

        if (!categoria_id || !nome || !preco) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        const result = await db.addServico(categoria_id, nome, preco, duracao_minutos || 60, descricao);

        // Broadcast novo serviço para todos os clientes
        broadcast({
            type: 'SERVICO_ADICIONADO',
            data: result
        });

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Excluir serviço
app.delete('/api/servicos/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteServico(id);

        broadcast({
            type: 'SERVICO_EXCLUIDO',
            servicoId: id
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - FINANCEIRO (CONSOLIDADO) ==========
app.get('/api/financeiro/consolidado', requireAuth, async (req, res) => {
    try {
        const { inicio, fim, unidade } = req.query;

        if (!inicio || !fim) {
            return res.status(400).json({ error: 'Parâmetros inicio e fim são obrigatórios' });
        }

        // Admin pode ver todas ou escolher unidade. Usuário comum só vê sua unidade
        const unidadeId = req.session.role === 'admin' ? (unidade ? parseInt(unidade) : null) : req.session.unidadeId;

        // Buscar agendamentos no período (query simplificada)
        let query = `SELECT * FROM agendamentos WHERE data BETWEEN $1 AND $2`;
        const params = [inicio, fim];

        if (unidadeId) {
            query += ` AND unidade_id = $3`;
            params.push(unidadeId);
        }

        query += ` ORDER BY data, hora_inicio`;

        const result = await db.pool.query(query, params);

        // Processar servicos (pode vir como string JSON)
        const agendamentos = result.rows.map(row => {
            let servicos = row.servicos;
            if (typeof servicos === 'string') {
                try { servicos = JSON.parse(servicos); } catch (e) { servicos = []; }
            }
            if (!Array.isArray(servicos)) servicos = [];

            return { ...row, servicos, tipo_registro: 'agendamento' };
        });

        // Buscar assinaturas pagas no período (para contabilizar Pacotes)
        const assinaturasResult = await db.pool.query(`
            SELECT a.id, a.nome_plano, t.nome as cliente_nome, a.valor_total, a.pago, a.forma_pagamento,
                   a.data_ultimo_pagamento::date as data, a.creditos_total, a.creditos_usados
            FROM assinaturas a
            LEFT JOIN tutores t ON a.cliente_id = t.id
            WHERE a.pago = 1 
              AND a.data_ultimo_pagamento IS NOT NULL
              AND a.data_ultimo_pagamento::date BETWEEN $1 AND $2
            ORDER BY a.data_ultimo_pagamento DESC
        `, [inicio, fim]);

        // Mapear assinaturas pagas como registros
        const assinaturasPagas = assinaturasResult.rows.map(row => ({
            id: `assinatura_${row.id}`,
            pet_nome: row.cliente_nome,
            data: row.data,
            valor_total: row.valor_total,
            pago: true,
            forma_pagamento: row.forma_pagamento,
            assinatura_id: row.id, // Marca como "pacote" para contabilidade
            tipo_registro: 'assinatura',
            servicos: []
        }));

        // Buscar assinaturas NÃO pagas usando data do primeiro agendamento (para A Receber)
        console.log(`[DEBUG] Buscando assinaturas não pagas para período: ${inicio} a ${fim}`);
        const assinaturasNaoPagasResult = await db.pool.query(`
            SELECT a.id, a.nome_plano, t.nome as cliente_nome, a.valor_total, a.pago,
                   (SELECT MIN(ag.data) FROM agendamentos ag WHERE ag.assinatura_id = a.id) as data_primeiro_agendamento,
                   a.creditos_total, a.creditos_usados
            FROM assinaturas a
            LEFT JOIN tutores t ON a.cliente_id = t.id
            WHERE a.pago = 0 
              AND a.ativo = 1
              AND EXISTS (SELECT 1 FROM agendamentos ag WHERE ag.assinatura_id = a.id AND ag.data BETWEEN $1 AND $2)
            ORDER BY a.created_at DESC
        `, [inicio, fim]);

        // Mapear assinaturas não pagas como registros (para A Receber)
        const assinaturasNaoPagas = assinaturasNaoPagasResult.rows.map(row => ({
            id: `assinatura_pendente_${row.id}`,
            pet_nome: row.cliente_nome,
            data: row.data_primeiro_agendamento,
            valor_total: row.valor_total,
            pago: false,
            forma_pagamento: null,
            assinatura_id: row.id, // Marca como "pacote" para contabilidade
            tipo_registro: 'assinatura_pendente',
            servicos: []
        }));

        // Combinar agendamentos + assinaturas pagas + assinaturas não pagas
        console.log(`[DEBUG] Assinaturas não pagas encontradas: ${assinaturasNaoPagas.length}`);
        const todosRegistros = [...agendamentos, ...assinaturasPagas, ...assinaturasNaoPagas];

        res.json(todosRegistros);
    } catch (error) {
        console.error('Erro ao buscar financeiro consolidado:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - EXTRAS (Pagamento de serviços extras) ==========
app.patch('/api/agendamentos/:id/pagar-extras', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { forma_pagamento } = req.body;

        if (!forma_pagamento) {
            return res.status(400).json({ error: 'Forma de pagamento é obrigatória' });
        }

        // Atualizar extras_pago para true
        const result = await db.pool.query(`
            UPDATE agendamentos 
            SET extras_pago = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        // Broadcast atualização
        broadcast({
            type: 'AGENDAMENTO_ATUALIZADO',
            data: result.rows[0]
        });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao pagar extras:', error);
        res.status(500).json({ error: error.message });
    }
});

// Adicionar extra em agendamento existente
app.patch('/api/agendamentos/:id/adicionar-extra', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { extras_descricao, extras_valor } = req.body;

        if (!extras_descricao || !extras_valor) {
            return res.status(400).json({ error: 'Descrição e valor são obrigatórios' });
        }

        // Atualizar agendamento com extras
        const result = await db.pool.query(`
            UPDATE agendamentos 
            SET extras_descricao = $1, extras_valor = $2, extras_pago = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [extras_descricao, extras_valor, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        // Broadcast atualização
        broadcast({
            type: 'AGENDAMENTO_ATUALIZADO',
            data: result.rows[0]
        });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao adicionar extra:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - LEMBRETES ==========
app.get('/api/lembretes', requireAuth, async (req, res) => {
    try {
        // Apenas Gerente ou Admin podem acessar
        if (!['admin', 'gerente'].includes(req.session.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const hoje = new Date().toISOString().split('T')[0];
        const em7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const em14Dias = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const ha40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Clientes inativos (40+ dias sem agendamento)
        const inativosResult = await db.pool.query(`
            SELECT DISTINCT ON (t.id) 
                t.id as tutor_id, t.nome as tutor_nome, t.telefone,
                p.id as pet_id, p.nome as pet_nome,
                MAX(a.data) as ultimo_agendamento
            FROM tutores t
            JOIN pets p ON p.tutor_id = t.id
            LEFT JOIN agendamentos a ON a.pet_nome = p.nome
            WHERE p.ativo = 1
            GROUP BY t.id, t.nome, t.telefone, p.id, p.nome
            HAVING MAX(a.data) IS NULL OR MAX(a.data) < $1
            LIMIT 50
        `, [ha40Dias]);

        // 2. Pagamentos pendentes (agendamentos avulsos não pagos)
        const agendamentosPendentesResult = await db.pool.query(`
            SELECT a.id, a.pet_nome, a.data, a.valor_total, a.forma_pagamento,
                   a.assinatura_id, NULL as tipo
            FROM agendamentos a
            WHERE a.pago = 0 AND a.data <= $1 AND a.assinatura_id IS NULL
            ORDER BY a.data DESC
            LIMIT 50
        `, [hoje]);

        // 2b. Assinaturas não pagas (usando data do primeiro agendamento)
        const assinaturasPendentesResult = await db.pool.query(`
            SELECT a.id, t.nome as pet_nome, 
                   (SELECT MIN(ag.data) FROM agendamentos ag WHERE ag.assinatura_id = a.id) as data,
                   a.valor_total, NULL as forma_pagamento,
                   a.id as assinatura_id, 'assinatura' as tipo,
                   t.telefone
            FROM assinaturas a
            LEFT JOIN tutores t ON a.cliente_id = t.id
            WHERE a.pago = 0 AND a.ativo = 1
            ORDER BY a.created_at DESC
            LIMIT 50
        `);

        // Combinar agendamentos + assinaturas pendentes
        const pagamentosPendentes = [
            ...agendamentosPendentesResult.rows,
            ...assinaturasPendentesResult.rows
        ];

        // 3. Renovações de assinatura (créditos zerados)
        const renovacoesResult = await db.pool.query(`
            SELECT s.id, s.nome_plano, t.nome as cliente_nome, s.valor_total,
                   s.creditos_total, s.creditos_usados, t.telefone
            FROM assinaturas s
            LEFT JOIN tutores t ON s.cliente_id = t.id
            WHERE s.ativo = 1 AND s.creditos_usados >= s.creditos_total
            LIMIT 50
        `);

        // 4. Aniversários próximos (7 dias)
        const aniversariosResult = await db.pool.query(`
            SELECT p.id as pet_id, p.nome as pet_nome, p.data_nascimento,
                   t.id as tutor_id, t.nome as tutor_nome, t.telefone
            FROM pets p
            JOIN tutores t ON p.tutor_id = t.id
            WHERE p.data_nascimento IS NOT NULL 
              AND p.ativo = 1
              AND TO_CHAR(p.data_nascimento, 'MM-DD') BETWEEN 
                  TO_CHAR(CURRENT_DATE, 'MM-DD') AND TO_CHAR(CURRENT_DATE + INTERVAL '7 days', 'MM-DD')
            LIMIT 50
        `);

        // 5. Vermífugo próximo/vencido (14 dias)
        const vermifugosResult = await db.pool.query(`
            SELECT p.id as pet_id, p.nome as pet_nome, p.data_proximo_vermifugo,
                   t.id as tutor_id, t.nome as tutor_nome, t.telefone
            FROM pets p
            JOIN tutores t ON p.tutor_id = t.id
            WHERE p.data_proximo_vermifugo IS NOT NULL 
              AND p.ativo = 1
              AND p.data_proximo_vermifugo <= $1
            ORDER BY p.data_proximo_vermifugo ASC
            LIMIT 50
        `, [em14Dias]);

        // 6. Antiparasitário próximo/vencido (14 dias)
        const antiparasitariosResult = await db.pool.query(`
            SELECT p.id as pet_id, p.nome as pet_nome, p.data_proximo_antiparasita,
                   t.id as tutor_id, t.nome as tutor_nome, t.telefone
            FROM pets p
            JOIN tutores t ON p.tutor_id = t.id
            WHERE p.data_proximo_antiparasita IS NOT NULL 
              AND p.ativo = 1
              AND p.data_proximo_antiparasita <= $1
            ORDER BY p.data_proximo_antiparasita ASC
            LIMIT 50
        `, [em14Dias]);

        res.json({
            inativos: inativosResult.rows,
            pagamentos_pendentes: pagamentosPendentes,
            renovacoes: renovacoesResult.rows,
            aniversarios: aniversariosResult.rows,
            vermifugos: vermifugosResult.rows,
            antiparasitarios: antiparasitariosResult.rows
        });
    } catch (error) {
        console.error('Erro ao buscar lembretes:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - TEMPLATES DE MENSAGENS ==========
app.get('/api/templates', requireAuth, async (req, res) => {
    try {
        // Apenas Gerente ou Admin podem acessar
        if (!['admin', 'gerente'].includes(req.session.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const result = await db.pool.query(`
            SELECT tipo, template, atualizado_em FROM templates_mensagens ORDER BY tipo
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar templates:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/templates/:tipo', requireAuth, async (req, res) => {
    try {
        // Apenas Gerente ou Admin podem editar
        if (!['admin', 'gerente'].includes(req.session.role)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { tipo } = req.params;
        const { template } = req.body;

        if (!template || template.trim().length === 0) {
            return res.status(400).json({ error: 'Template não pode ser vazio' });
        }

        const result = await db.pool.query(`
            INSERT INTO templates_mensagens (tipo, template, atualizado_em)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (tipo) DO UPDATE SET template = $2, atualizado_em = CURRENT_TIMESTAMP
            RETURNING *
        `, [tipo, template.trim()]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar template:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - AGENDAMENTOS (PROTEGIDAS) ==========
app.get('/api/agendamentos', requireAuth, async (req, res) => {
    try {
        const { data, unidade, assinatura_id } = req.query;

        // Se filtro por assinatura_id, buscar agendamentos vinculados
        if (assinatura_id) {
            const agendamentos = await db.getAgendamentosByAssinatura(assinatura_id);
            return res.json(agendamentos);
        }

        // Admin pode ver todas ou escolher unidade. Usuário comum só vê sua unidade
        const unidadeId = req.session.role === 'admin' ? (unidade ? parseInt(unidade) : null) : req.session.unidadeId;
        const agendamentos = await db.getAgendamentos(data, unidadeId);
        res.json(agendamentos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single appointment by ID (for refund check)
app.get('/api/agendamentos/:id', requireAuth, async (req, res) => {
    try {
        const agendamento = await db.getAgendamentoById(req.params.id);
        if (!agendamento) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }
        res.json(agendamento);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/agendamentos', requireAuth, requireCreatePermission, async (req, res) => {
    try {
        const agendamento = req.body;

        // Validação básica
        if (!agendamento.pet_nome || !agendamento.data || !agendamento.hora_inicio) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        // Adicionar unidade_id do usuário se não for fornecida
        if (!agendamento.unidade_id) {
            agendamento.unidade_id = req.session.unidadeId || 1;
        }

        const result = await db.createAgendamento(agendamento);

        // Broadcast novo agendamento para todos os clientes
        broadcast({
            type: 'AGENDAMENTO_CRIADO',
            data: result
        });

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/agendamentos/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const agendamento = req.body;

        const result = await db.updateAgendamento(id, agendamento);

        // Broadcast atualização para todos os clientes
        broadcast({
            type: 'AGENDAMENTO_ATUALIZADO',
            data: result
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET agendamento específico (para verificar dados antes de excluir)
app.get('/api/agendamentos/:id', requireAuth, async (req, res) => {
    try {
        const agendamento = await db.getAgendamentoById(req.params.id);
        if (!agendamento) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }
        res.json(agendamento);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/agendamentos/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteAgendamento(id);

        // Broadcast exclusão para todos os clientes
        broadcast({
            type: 'AGENDAMENTO_EXCLUIDO',
            id: id
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH - Update Payment Status  
app.patch('/api/agendamentos/:id/payment', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { pago, forma_pagamento } = req.body;

        const agendamento = await db.getAgendamentoById(id);

        if (!agendamento) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        // Usar valor de pago enviado pelo frontend
        const novoPago = pago ? 1 : 0;

        // Se está marcando como pago, forma_pagamento é obrigatória
        if (novoPago === 1 && !forma_pagamento) {
            return res.status(400).json({ error: 'Forma de pagamento é obrigatória' });
        }

        await db.updateAgendamento(id, {
            ...agendamento,
            pago: novoPago,
            forma_pagamento: novoPago === 1 ? forma_pagamento : null
        });

        // INTEGRAÇÃO CAIXA: Registrar movimentação se for dinheiro
        try {
            // 1. Pagamento NOVO em dinheiro
            if (novoPago === 1 && forma_pagamento === 'dinheiro') {
                // Verificar se já não estava pago em dinheiro antes para não duplicar
                if (!(agendamento.pago === 1 && agendamento.forma_pagamento === 'dinheiro')) {
                    await db.addCaixaTransacao({
                        unidade_id: agendamento.unidade_id || 1,
                        valor: agendamento.valor_total || 0,
                        categoria: 'agendamento',
                        descricao: `Pagamento Agendamento #${id} - ${agendamento.pet_nome}`,
                        agendamento_id: id,
                        usuario_id: req.session.userId
                    });
                }
            }
            // 2. Estorno/Troca (Era dinheiro e mudou para não pago ou outro método)
            else if (agendamento.pago === 1 && agendamento.forma_pagamento === 'dinheiro') {
                // Se agora não é pago ou não é dinheiro, estornar o valor antigo
                if (novoPago === 0 || forma_pagamento !== 'dinheiro') {
                    await db.addCaixaTransacao({
                        unidade_id: agendamento.unidade_id || 1,
                        valor: -(agendamento.valor_total || 0), // Valor negativo
                        categoria: 'agendamento',
                        descricao: `Estorno/Alteração Agendamento #${id} - ${agendamento.pet_nome}`,
                        agendamento_id: id,
                        usuario_id: req.session.userId
                    });
                }
            }
        } catch (errCaixa) {
            console.error('Erro ao registrar transação no caixa:', errCaixa);
            // Não falhar a requisição principal, apenas logar erro
        }

        // Broadcast atualização
        broadcast({
            type: 'PAGAMENTO_ATUALIZADO',
            agendamentoId: id,
            pago: novoPago === 1,
            forma_pagamento: novoPago === 1 ? forma_pagamento : null
        });

        res.json({ success: true, pago: novoPago === 1, forma_pagamento: novoPago === 1 ? forma_pagamento : null });
    } catch (error) {
        console.error('Erro toggle payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - TUTORES ==========
app.post('/api/tutores', requireAuth, requireClientManagement, async (req, res) => {
    console.log('🔥 ROTA /api/tutores CHAMADA!');
    try {
        const tutor = req.body;

        console.log('📝 Dados do tutor recebidos:', tutor);

        if (!tutor.nome || !tutor.telefone) {
            return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
        }

        const result = await db.createTutor(tutor);
        console.log('✅ Tutor criado:', result);
        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Erro ao criar tutor:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tutores', requireAuth, async (req, res) => {
    try {
        const tutores = await db.getAllTutores();
        res.json(tutores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tutores/search', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }
        const tutores = await db.searchTutores(q);
        res.json(tutores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tutores/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const tutor = await db.getTutorById(id);

        if (!tutor) {
            return res.status(404).json({ error: 'Tutor não encontrado' });
        }

        res.json(tutor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tutores/:id', requireAuth, requireClientManagement, async (req, res) => {
    try {
        const { id } = req.params;
        const tutor = req.body;

        const result = await db.updateTutor(id, tutor);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tutores/import', requireAuth, requireClientManagement, async (req, res) => {
    try {
        const dados = req.body;
        if (!Array.isArray(dados) || dados.length === 0) {
            return res.status(400).json({ error: 'Dados inválidos para importação' });
        }

        const result = await db.importarClientesEmLote(dados);
        res.status(201).json(result);
    } catch (error) {
        console.error('Erro na importação em lote:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tutores/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.deleteTutor(id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - PETS ==========
app.post('/api/pets', requireAuth, requireClientManagement, async (req, res) => {
    console.log('🐾 ROTA /api/pets CHAMADA!');
    try {
        const pet = req.body;

        console.log('📝 Dados do pet recebidos:', pet);

        if (!pet.tutor_id || !pet.nome || !pet.raca || !pet.peso) {
            console.log('❌ Validação falhou - dados básicos faltando');
            return res.status(400).json({ error: 'Dados básicos do pet são obrigatórios' });
        }

        const result = await db.createPet(pet);

        console.log('✅ Pet criado:', result);

        // Verificar e criar lembretes apenas se tiver datas
        if (pet.data_nascimento || pet.data_proximo_vermifugo) {
            console.log('📅 Verificando lembretes...');
            await db.verificarECriarLembretes();
        } else {
            console.log('⏭️ Sem datas - pulando lembretes');
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Erro ao criar pet:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pets', requireAuth, async (req, res) => {
    try {
        const { tutor_id } = req.query;
        if (tutor_id) {
            const pets = await db.getPetsByTutor(tutor_id);
            res.json(pets);
        } else {
            const pets = await db.getAllPets();
            res.json(pets);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pets/autocomplete', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json([]);
        }
        const pets = await db.searchPetsAutocomplete(q);
        res.json(pets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pets/tutor/:tutorId', requireAuth, async (req, res) => {
    try {
        const { tutorId } = req.params;
        const pets = await db.getPetsByTutorId(tutorId);
        res.json(pets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pets/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const pet = await db.getPetById(id);

        if (!pet) {
            return res.status(404).json({ error: 'Pet não encontrado' });
        }

        res.json(pet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/pets/:id', requireAuth, requireClientManagement, async (req, res) => {
    try {
        const { id } = req.params;
        const pet = req.body;

        const result = await db.updatePet(id, pet);

        // Recriar lembretes se datas mudaram
        await db.verificarECriarLembretes();

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/pets/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.deactivatePet(id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - LEMBRETES ==========
app.get('/api/lembretes/pendentes', requireAuth, async (req, res) => {
    try {
        const lembretes = await db.getLembretesPendentes();
        res.json(lembretes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/lembretes/:id/avisar', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Marcar como avisado
        await db.updateLembreteStatus(id, 'avisado');

        // TODO: Atualizar próxima data se for vermífugo
        // Isso será implementado no frontend ao marcar como avisado

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/lembretes/:id/adiar', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await db.adiarLembrete(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTA - DADOS DO CLIENTE POR AGENDAMENTO ==========
app.get('/api/agendamentos/:id/cliente', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const agendamento = await db.getAgendamentoById(id);

        if (!agendamento) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        // Se tem pet_id, buscar dados completos
        if (agendamento.pet_id) {
            const pet = await db.getPetById(agendamento.pet_id);
            return res.json({
                agendamento,
                pet: pet || null,
                tutor: pet ? {
                    nome: pet.tutor_nome,
                    telefone: pet.tutor_telefone,
                    endereco: pet.tutor_endereco
                } : null
            });
        }

        // Sem pet_id, retornar apenas agendamento
        res.json({
            agendamento,
            pet: null,
            tutor: null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - FINANCEIRO (APENAS ADMIN) ==========
app.get('/api/financeiro/consolidado', requireFinanceiro, async (req, res) => {
    try {
        const { inicio, fim, unidade } = req.query;
        // Se usuário for admin, usa unidade da query, senão usa da sessão
        const unidadeId = req.session.role === 'admin' ? (unidade ? parseInt(unidade) : null) : req.session.unidadeId;

        const movimentacoes = await db.getMovimentacaoCaixa(inicio, fim, unidadeId);
        res.json(movimentacoes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/financeiro/diario/:data', requireFinanceiro, async (req, res) => {
    try {
        const { data } = req.params;
        const { unidade } = req.query;
        const unidadeId = unidade ? parseInt(unidade) : null;
        const agendamentos = await db.getRelatorioFinanceiroDiario(data, unidadeId);
        res.json(agendamentos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/financeiro/mensal/:ano/:mes', requireFinanceiro, async (req, res) => {
    try {
        const { ano, mes } = req.params;
        const { unidade } = req.query;
        const unidadeId = unidade ? parseInt(unidade) : null;
        const agendamentos = await db.getRelatorioFinanceiroMensal(parseInt(ano), parseInt(mes), unidadeId);
        res.json(agendamentos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/financeiro/anual/:ano', requireFinanceiro, async (req, res) => {
    try {
        const { ano } = req.params;
        const { unidade } = req.query;
        const unidadeId = unidade ? parseInt(unidade) : null;
        const agendamentos = await db.getRelatorioFinanceiroAnual(parseInt(ano), unidadeId);
        res.json(agendamentos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Backup automático do banco de dados
// ========== ROTAS - CAIXA (GERENTE/ADMIN) ==========

app.get('/api/caixa/saldo', requireAuth, async (req, res) => {
    try {
        const { unidade_id } = req.query;
        // Se usuário comum, forçar sua unidade
        const unidade = req.session.role === 'admin' && unidade_id
            ? parseInt(unidade_id)
            : (req.session.unidadeId || 1);

        const saldo = await db.getCaixaSaldo(unidade);
        res.json({ saldo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/caixa/extrato', requireAuth, async (req, res) => {
    try {
        const { unidade_id, limit } = req.query;
        const unidade = req.session.role === 'admin' && unidade_id
            ? parseInt(unidade_id)
            : (req.session.unidadeId || 1);

        const extrato = await db.getCaixaExtrato(unidade, limit ? parseInt(limit) : 50);
        res.json(extrato);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/caixa/transacao', requireAuth, async (req, res) => {
    try {
        // Apenas gerente/admin pode lançar manual
        if (req.session.role !== 'admin' && req.session.role !== 'gerente') {
            return res.status(403).json({ error: 'Permissão negada' });
        }

        const { unidade_id, valor, descricao } = req.body;

        if (!valor || !descricao) {
            return res.status(400).json({ error: 'Valor e descrição são obrigatórios' });
        }

        const result = await db.addCaixaTransacao({
            unidade_id: unidade_id || req.session.unidadeId || 1,
            valor: parseFloat(valor),
            categoria: 'manual',
            descricao,
            usuario_id: req.session.userId
        });

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/caixa/zerar', requireAuth, async (req, res) => {
    try {
        // Apenas admin ou gerente pode zerar
        if (req.session.role !== 'admin' && req.session.role !== 'gerente') {
            return res.status(403).json({ error: 'Permissão negada' });
        }

        const { unidade_id } = req.body;
        const unidade = unidade_id || req.session.unidadeId || 1;

        const result = await db.zerarCaixa(unidade, req.session.userId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.delete('/api/caixa/transacoes', requireAuth, async (req, res) => {
    try {
        // Apenas admin pode limpar histórico
        if (req.session.role !== 'admin') {
            return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem limpar o histórico.' });
        }

        const { unidade_id } = req.body; // Opcional, se não vier usa a do body ou session, mas delete body normamente não tem payload em alguns clients, melhor query ou body
        // Vamos aceitar pelo body ou query para facilitar
        const unidade = (req.body && req.body.unidade_id) || req.query.unidade_id || req.session.unidadeId || 1;

        const result = await db.limparHistoricoCaixa(unidade);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// ========== ROTAS - PACOTES ==========
app.get('/api/pacotes', requireAuth, async (req, res) => {
    try {
        const pacotes = await db.getPacotes();
        res.json(pacotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pacotes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const pacote = req.body;
        const result = await db.createPacote(pacote);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/pacotes/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const pacote = req.body;
        const result = await db.updatePacote(id, pacote);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/pacotes/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.deletePacote(id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ROTAS - VENDAS DE PACOTES ==========
// Buscar TODAS as assinaturas ativas (para admin/gerente ver geral)
app.get('/api/pacotes/ativos', requireAuth, async (req, res) => {
    try {
        const pacotes = await db.getAllPacotesAtivos();
        res.json(pacotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pacotes/cliente/:tutorId/todos', requireAuth, async (req, res) => {
    try {
        const { tutorId } = req.params;
        const pacotes = await db.getTodosPacotesCliente(tutorId);
        res.json(pacotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pacotes/cliente/:tutorId', requireAuth, async (req, res) => {
    try {
        const { tutorId } = req.params;
        const pacotes = await db.getPacotesCliente(tutorId);
        res.json(pacotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter histórico de agendamentos de um pacote específico
app.get('/api/pacotes/:clientePacoteId/agendamentos', requireAuth, async (req, res) => {
    try {
        const { clientePacoteId } = req.params;
        console.log(`📋 Buscando agendamentos do pacote ID: ${clientePacoteId}`);

        // Buscar agendamentos que usaram este pacote
        const agendamentos = await db.getAgendamentosPorPacote(clientePacoteId);

        console.log(`✅ Encontrados ${agendamentos.length} agendamentos`);
        res.json(agendamentos);
    } catch (error) {
        console.error('❌ Erro ao buscar agendamentos do pacote:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pacotes/venda', requireAuth, requireCreatePermission, async (req, res) => {
    try {
        const venda = req.body;
        // Adicionar userId e unidadeId da sessão
        venda.userId = req.session.userId;
        venda.unidadeId = req.session.unidadeId || 1;

        const result = await db.comprarPacote(venda);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/pacotes/consumir', requireAuth, async (req, res) => {
    try {
        const { cliente_pacote_id } = req.body;
        const result = await db.consumirCreditoPacote(cliente_pacote_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para estornar crédito de pacote (quando agendamento é cancelado)
app.post('/api/pacotes/estornar', requireAuth, async (req, res) => {
    try {
        const { cliente_pacote_id } = req.body;
        const result = await db.estornarCreditoPacote(cliente_pacote_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para pagar pacote vendido a prazo
app.put('/api/pacotes/cliente/:id/pagar', requireAuth, async (req, res) => {
    try {
        const clientePacoteId = req.params.id;
        const { forma_pagamento } = req.body;
        const unidadeId = req.session.unidadeId || 1; // Fallback para unidade 1
        const userId = req.session.userId;

        await db.pagarPacote(clientePacoteId, forma_pagamento, unidadeId, userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao pagar pacote:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rota para cancelar assinatura
app.put('/api/pacotes/cliente/:id/cancelar', requireAuth, async (req, res) => {
    try {
        const clientePacoteId = req.params.id;
        await db.cancelarPacote(clientePacoteId);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao cancelar pacote:', error);
        res.status(500).json({ error: error.message });
    }
});

// Inicializar banco de dados e servidor
async function start() {
    try {
        await db.initDatabase();
        // Backup removido: Banco de dados agora é em nuvem (Supabase)


        server.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════╗
║   🐾 Halfeld PetCare - Sistema de Agenda    ║
╠═══════════════════════════════════════════════╣
║  Servidor rodando em: http://localhost:${PORT}  ║
║  WebSocket ativo para sincronização          ║
║  Acesse: http://localhost:${PORT}               ║
╚═══════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

start();


// === ENDPOINTS DE GESTO ===

// Templates de mensagens
app.get('/api/templates', requireAuth, async (req, res) => {
    try {
        const templates = await db.getTemplates();
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/templates/:tipo', requireAuth, async (req, res) => {
    try {
        const { template } = req.body;
        const updated = await db.updateTemplate(req.params.tipo, template);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Anlise de clientes
app.get('/api/relatorios/clientes/analise', requireAuth, async (req, res) => {
    try {
        const analise = await db.getAnaliseClientes();
        res.json(analise);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/relatorios/clientes/inativos', requireAuth, async (req, res) => {
    try {
        const { dias = 30 } = req.query;
        const inativos = await db.getClientesInativos(parseInt(dias));
        res.json(inativos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




// ===== ENDPOINTS ASSINATURAS =====

// Criar assinatura
app.post('/api/assinaturas', requireAuth, async (req, res) => {
    try {
        const result = await db.createAssinatura(req.body);
        console.log('✓ Assinatura criada:', result.id);
        res.status(201).json(result);
    } catch (error) {
        console.error('Erro ao criar assinatura:', error);
        res.status(500).json({ error: error.message });
    }
});

// Listar todas assinaturas
app.get('/api/assinaturas', requireAuth, async (req, res) => {
    try {
        const assinaturas = await db.getAllAssinaturas();
        console.log('✓ Assinaturas carregadas:', assinaturas?.length || 0);
        res.json(assinaturas || []);
    } catch (error) {
        console.error('✗ Erro getAllAssinaturas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Buscar assinatura por ID
app.get('/api/assinaturas/:id', requireAuth, async (req, res) => {
    try {
        const assinatura = await db.getAssinaturaById(req.params.id);
        if (!assinatura) {
            return res.status(404).json({ error: 'Assinatura não encontrada' });
        }
        res.json(assinatura);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pagar assinatura
app.patch('/api/assinaturas/:id/pagar', requireAuth, async (req, res) => {
    try {
        const { forma_pagamento } = req.body;
        if (!forma_pagamento) {
            return res.status(400).json({ error: 'Forma de pagamento obrigatória' });
        }
        const assinatura = await db.pagarAssinatura(req.params.id, forma_pagamento);

        // Registrar no caixa se dinheiro
        if (forma_pagamento === 'dinheiro' && assinatura.valor_total > 0) {
            try {
                await db.addCaixaTransacao({
                    unidade_id: 1,
                    valor: assinatura.valor_total,
                    categoria: 'assinatura',
                    descricao: `Pagamento Assinatura #${assinatura.id} - ${assinatura.nome_plano}`,
                    usuario_id: req.session.userId
                });
            } catch (e) {
                console.error('Erro ao registrar no caixa:', e);
            }
        }

        res.json(assinatura);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelar pagamento
app.patch('/api/assinaturas/:id/cancelar-pagamento', requireAuth, async (req, res) => {
    try {
        const result = await db.cancelarPagamentoAssinatura(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Renovar assinatura
app.patch('/api/assinaturas/:id/renovar', requireAuth, async (req, res) => {
    try {
        const { creditos_total, valor_total } = req.body;
        const result = await db.renovarAssinatura(req.params.id, creditos_total, valor_total);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar assinatura
app.put('/api/assinaturas/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.updateAssinatura(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelar (desativar) assinatura
app.delete('/api/assinaturas/:id', requireAuth, async (req, res) => {
    try {
        await db.cancelarAssinatura(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Usar crédito de assinatura (ao agendar)
app.patch('/api/assinaturas/:id/usar-credito', requireAuth, async (req, res) => {
    try {
        const result = await db.usarCreditoAssinatura(req.params.id);
        console.log(`✓ Crédito usado: Assinatura #${req.params.id}`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Estornar crédito de assinatura (ao cancelar agendamento)
app.patch('/api/assinaturas/:id/estornar-credito', requireAuth, async (req, res) => {
    try {
        const result = await db.estornarCreditoAssinatura(req.params.id);
        console.log(`✓ Crédito estornado: Assinatura #${req.params.id}`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
