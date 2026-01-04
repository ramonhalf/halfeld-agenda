const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hash de senha usando bcrypt
 * @param {string} password - Senha em texto plano
 * @returns {Promise<string>} Hash da senha
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verificar senha contra hash
 * @param {string} password - Senha em texto plano
 * @param {string} hash - Hash armazenado
 * @returns {Promise<boolean>} True se senha correta
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Middleware para verificar autenticação
 * Redireciona para login se não autenticado
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }

    // Se for requisição de API, retorna 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    // Se for página, redireciona para login
    return res.redirect('/login.html');
}

/**
 * Middleware para verificar se é administrador
 * Requer autenticação prévia
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Acesso negado - apenas administradores' });
}

/**
 * Middleware para verificar acesso ao financeiro
 * Apenas admins  têm acesso
 */
function requireFinanceiro(req, res, next) {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Acesso negado - apenas administradores podem ver financeiro' });
}

/**
 * Middleware opcional de autenticação
 * Carrega usuário se autenticado, mas não bloqueia
 */
function optionalAuth(req, res, next) {
    // Adiciona informações do usuário ao request se autenticado
    if (req.session && req.session.userId) {
        req.userId = req.session.userId;
        req.userRole = req.session.role;
        req.userUnidadeId = req.session.unidadeId;
    }
    next();
}

/**
 * Middleware para verificar permissão de criar agendamentos
 * Admin e Gerente podem criar, Operação não pode
 */
function requireCreatePermission(req, res, next) {
    if (req.session && req.session.userId &&
        (req.session.role === 'admin' || req.session.role === 'gerente')) {
        return next();
    }
    return res.status(403).json({ error: 'Sem permissão para criar agendamentos' });
}

/**
 * Middleware para verificar permissão de criar/editar clientes
 * Admin e Gerente podem criar, Operação não pode
 */
function requireClientManagement(req, res, next) {
    if (req.session && req.session.userId &&
        (req.session.role === 'admin' || req.session.role === 'gerente')) {
        return next();
    }
    return res.status(403).json({ error: 'Sem permissão para gerenciar clientes' });
}

module.exports = {
    hashPassword,
    verifyPassword,
    requireAuth,
    requireAdmin,
    requireFinanceiro,
    requireCreatePermission,
    requireClientManagement,
    optionalAuth
};
