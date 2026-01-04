// ========== GERENCIAMENTO DE USUÁRIOS ==========

let usuarioAtual = null; // Dados do usuário logado

// Carregar lista de usuários
async function carregarListaUsuarios() {
    try {
        const response = await fetch('/api/usuarios');
        if (!response.ok) throw new Error('Erro ao carregar usuários');

        const usuarios = await response.json();
        renderizarListaUsuarios(usuarios);
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        mostrarNotificacao('Erro ao carregar lista de usuários', 'error');
    }
}

// Renderizar lista de usuários
function renderizarListaUsuarios(usuarios) {
    const container = document.getElementById('usuariosLista');
    if (!container) return;

    if (usuarios.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhum usuário cadastrado</p>';
        return;
    }

    container.innerHTML = usuarios.map(usuario => `
        <div class="usuario-card">
            <div class="usuario-info">
                <div class="usuario-nome">${usuario.nome_completo}</div>
                <div class="usuario-username">@${usuario.username}</div>
            </div>
            <div class="usuario-badges">
                <span class="role-badge badge-${usuario.role}">
                    ${usuario.funcao || (usuario.role === 'admin' ? 'Admin' : 'Usuário')}
                </span>
                ${usuario.unidade_id ? `<span class="unidade-badge">📍 Unidade ${String(usuario.unidade_id).padStart(2, '0')}</span>` : '<span class="unidade-badge badge-todas">🌐 Todas</span>'}
                <span class="status-badge ${usuario.ativo ? 'badge-ativo' : 'badge-inativo'}">
                    ${usuario.ativo ? '✓ Ativo' : '✗ Inativo'}
                </span>
            </div>
            <div class="usuario-actions">
                <button class="btn-icon" onclick="editarUsuario(${usuario.id})" title="Editar">✏️</button>
                <button class="btn-icon" onclick="redefinirSenhaUsuario(${usuario.id})" title="Redefinir Senha">🔑</button>
                <button class="btn-icon" onclick="toggleStatusUsuario(${usuario.id}, ${usuario.ativo})" title="${usuario.ativo ? 'Desativar' : 'Ativar'}">
                    ${usuario.ativo ? '🚫' : '✅'}
                </button>
                <button class="btn-icon" onclick="excluirUsuario(${usuario.id}, '${usuario.username}')" title="Excluir" style="color: #EF4444;">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Criar novo usuário
async function criarNovoUsuario() {
    console.log('🚀 criarNovoUsuario CHAMADO!');
    const form = document.getElementById('formNovoUsuario');
    if (!form) {
        console.error('❌ Formulário formNovoUsuario não encontrado!');
        return;
    }

    const formData = new FormData(form);
    const dados = {
        username: formData.get('username'),
        password: formData.get('password'),
        nomeCompleto: formData.get('nomeCompleto'),
        role: formData.get('role'),
        funcao: formData.get('funcao'),
        unidadeId: formData.get('unidadeId') ? parseInt(formData.get('unidadeId')) : null
    };

    console.log('📝 Dados capturados do formulário:', dados);

    // Validações
    if (!dados.username || !dados.password || !dados.nomeCompleto || !dados.role || !dados.funcao) {
        console.warn('⚠️ Campos obrigatórios faltando');
        mostrarNotificacao('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    if (dados.password.length < 6) {
        console.warn('⚠️ Senha muito curta');
        mostrarNotificacao('Senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }

    if (formData.get('confirmarSenha') !== dados.password) {
        console.warn('⚠️ Senhas não conferem');
        mostrarNotificacao('As senhas não conferem', 'error');
        return;
    }

    if (dados.role !== 'admin' && !dados.unidadeId) {
        console.warn('⚠️ Usuário comum sem unidade');
        mostrarNotificacao('Usuários comuns devem ter uma unidade atribuída', 'error');
        return;
    }

    try {
        console.log('📡 Enviando requisição POST para /api/usuarios...');
        const response = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        console.log('📥 Resposta recebida:', response.status, response.statusText);

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Erro da API:', error);
            throw new Error(error.error || 'Erro ao criar usuário');
        }

        console.log('✅ Usuário criado com sucesso!');
        mostrarNotificacao('Usuário criado com sucesso!', 'success');
        form.reset();
        carregarListaUsuarios();
    } catch (error) {
        console.error('❌ Erro no catch:', error);
        mostrarNotificacao(error.message, 'error');
    }
}

// Editar usuário
async function editarUsuario(id) {
    try {
        // Buscar dados do usuário
        const response = await fetch(`/api/usuarios/${id}`);
        if (!response.ok) throw new Error('Erro ao buscar usuário');

        const usuario = await response.json();

        // Criar overlay de modal para edição
        const existingOverlay = document.getElementById('editUserOverlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'editUserOverlay';
        overlay.className = 'forma-popup-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); z-index: 10000; display: flex; align-items: center; justify-content: center;';

        overlay.innerHTML = `
            <div class="forma-popup-card" style="max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0; color: var(--primary-gold);">✏️ Editar Usuário</h3>
                    <button onclick="document.getElementById('editUserOverlay').remove()" class="btn-close" style="font-size: 1.5rem;">×</button>
                </div>
                <form id="formEditUser" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="form-group">
                        <label>Nome Completo *</label>
                        <input type="text" id="editNomeCompleto" class="form-input" value="${usuario.nome_completo}" required>
                    </div>
                    <div class="form-group">
                        <label>Nome de Usuário</label>
                        <input type="text" class="form-input" value="${usuario.username}" disabled style="opacity: 0.6; cursor: not-allowed;">
                        <small style="color: var(--text-secondary); font-size: 0.8rem;">Username não pode ser alterado</small>
                    </div>
                    <div class="form-group">
                        <label>Função/Cargo *</label>
                        <select id="editFuncao" class="form-input" required>
                            <option value="CEO" ${usuario.funcao === 'CEO' ? 'selected' : ''}>CEO</option>
                            <option value="Admin" ${usuario.funcao === 'Admin' ? 'selected' : ''}>Admin</option>
                            <option value="Gerente" ${usuario.funcao === 'Gerente' ? 'selected' : ''}>Gerente</option>
                            <option value="Tosador" ${usuario.funcao === 'Tosador' ? 'selected' : ''}>Tosador</option>
                            <option value="Banhista" ${usuario.funcao === 'Banhista' ? 'selected' : ''}>Banhista</option>
                            <option value="Operação" ${usuario.funcao === 'Operação' ? 'selected' : ''}>Operação</option>
                            <option value="Taxy" ${usuario.funcao === 'Taxy' ? 'selected' : ''}>Taxy</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Acesso *</label>
                        <select id="editRole" class="form-input" onchange="toggleEditCampoUnidade()" required>
                            <option value="operacao" ${usuario.role === 'operacao' ? 'selected' : ''}>Operação (visualização)</option>
                            <option value="gerente" ${usuario.role === 'gerente' ? 'selected' : ''}>Gerente (sem financeiro)</option>
                            <option value="admin" ${usuario.role === 'admin' ? 'selected' : ''}>Administrador (total)</option>
                        </select>
                    </div>
                    <div class="form-group" id="editUnidadeContainer" style="${usuario.role === 'admin' ? 'display: none;' : ''}">
                        <label>Unidade *</label>
                        <select id="editUnidade" class="form-input">
                            <option value="">Selecione a unidade</option>
                            <option value="1" ${usuario.unidade_id === 1 ? 'selected' : ''}>Unidade 01</option>
                            <option value="2" ${usuario.unidade_id === 2 ? 'selected' : ''}>Unidade 02</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                        <button type="button" class="btn-secondary" style="flex: 1;" onclick="document.getElementById('editUserOverlay').remove()">Cancelar</button>
                        <button type="submit" class="btn-primary" style="flex: 1;">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(overlay);

        // Adicionar event listener para salvar
        document.getElementById('formEditUser').addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarEdicaoUsuario(id);
        });

        // Click fora do modal fecha
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        mostrarNotificacao('Erro ao carregar dados do usuário', 'error');
    }
}

// Função auxiliar para toggle do campo unidade no modal de edição
function toggleEditCampoUnidade() {
    const roleSelect = document.getElementById('editRole');
    const unidadeContainer = document.getElementById('editUnidadeContainer');

    if (roleSelect && unidadeContainer) {
        unidadeContainer.style.display = roleSelect.value === 'admin' ? 'none' : 'block';
    }
}

// Salvar edição do usuário
async function salvarEdicaoUsuario(id) {
    const nomeCompleto = document.getElementById('editNomeCompleto').value;
    const role = document.getElementById('editRole').value;
    const funcao = document.getElementById('editFuncao').value;
    const unidadeId = document.getElementById('editUnidade').value;

    // Validações
    if (!nomeCompleto || !role || !funcao) {
        mostrarNotificacao('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    if (role !== 'admin' && !unidadeId) {
        mostrarNotificacao('Usuários comuns devem ter uma unidade atribuída', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nomeCompleto,
                role,
                funcao,
                unidadeId: role === 'admin' ? null : parseInt(unidadeId)
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar usuário');
        }

        mostrarNotificacao('Usuário atualizado com sucesso!', 'success');

        // Fechar modal
        const overlay = document.getElementById('editUserOverlay');
        if (overlay) {
            overlay.remove();
        }

        // Recarregar lista
        carregarListaUsuarios();
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        mostrarNotificacao(error.message, 'error');
    }
}

// Redefinir senha
async function redefinirSenhaUsuario(id) {
    const novaSenha = prompt('Digite a nova senha (mínimo 6 caracteres):');
    if (!novaSenha) return;

    if (novaSenha.length < 6) {
        mostrarNotificacao('Senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/usuarios/${id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword: novaSenha })
        });

        if (!response.ok) throw new Error('Erro ao redefinir senha');

        mostrarNotificacao('Senha redefinida com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        mostrarNotificacao('Erro ao redefinir senha', 'error');
    }
}

// Ativar/Desativar usuário
async function toggleStatusUsuario(id, statusAtual) {
    const novoStatus = !statusAtual;
    const acao = novoStatus ? 'ativar' : 'desativar';

    if (!confirm(`Deseja realmente ${acao} este usuário?`)) return;

    try {
        const response = await fetch(`/api/usuarios/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: novoStatus })
        });

        if (!response.ok) throw new Error(`Erro ao ${acao} usuário`);

        mostrarNotificacao(`Usuário ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        carregarListaUsuarios();
    } catch (error) {
        console.error(`Erro ao ${acao} usuário:`, error);
        mostrarNotificacao(`Erro ao ${acao} usuário`, 'error');
    }
}

// Abrir modal de usuários
function abrirModalUsuarios() {
    const modal = document.getElementById('modalUsuarios');
    if (modal) {
        modal.style.display = 'block';
        carregarListaUsuarios();
    }
}

// Fechar modal de usuários
function fecharModalUsuarios() {
    const modal = document.getElementById('modalUsuarios');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Toggle campo de unidade baseado no role selecionado
function toggleCampoUnidade() {
    const roleSelect = document.querySelector('select[name="role"]');
    const unidadeContainer = document.getElementById('unidadeContainer');
    const unidadeSelect = document.querySelector('select[name="unidadeId"]');

    if (roleSelect && unidadeContainer && unidadeSelect) {
        if (roleSelect.value === 'admin') {
            unidadeContainer.style.display = 'none';
            unidadeSelect.removeAttribute('required');
            unidadeSelect.value = ''; // Limpar valor
        } else {
            unidadeContainer.style.display = 'block';
            unidadeSelect.setAttribute('required', 'required');
        }
    }
}

// Excluir usuário
async function excluirUsuario(id, username) {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o usuário @${username}?\n\nEsta ação não pode ser desfeita!`)) {
        return;
    }

    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao excluir usuário');
        }

        mostrarNotificacao('Usuário excluído com sucesso!', 'success');
        carregarListaUsuarios();
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        mostrarNotificacao(error.message, 'error');
    }
}

// Sugerir role baseado na função selecionada
function sugerirRole() {
    const funcaoSelect = document.querySelector('select[name="funcao"]');
    const roleSelect = document.querySelector('select[name="role"]');

    if (!funcaoSelect || !roleSelect) return;

    const funcao = funcaoSelect.value;
    const mapeamento = {
        'CEO': 'admin',
        'Admin': 'admin',
        'Gerente': 'gerente',
        'Tosador': 'operacao',
        'Banhista': 'operacao',
        'Operação': 'operacao',
        'Taxy': 'operacao'
    };

    if (mapeamento[funcao]) {
        roleSelect.value = mapeamento[funcao];
        toggleCampoUnidade(); // Atualizar visibilidade do campo unidade
    }
}

