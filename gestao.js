// === GESTÃO: Modal e Tabs ===

function abrirModalGestao() {
    const modal = document.getElementById('modalFinanceiro'); // Reusa modal existente
    modal.classList.add('active');

    // Se não tiver tabs ainda, criar estrutura
    if (!document.getElementById('tabsGestao')) {
        criarEstruturaGestao();
    }

    switchGestaoTab('financeiro');
}

function criarEstruturaGestao() {
    const modal = document.getElementById('modalFinanceiro');
    const header = modal.querySelector('.modal-header h2');
    header.innerHTML = '💼 Gestão';

    const body = modal.querySelector('.modal-body');
    const conteudoOriginal = body.innerHTML;

    body.innerHTML = `
        <div id="tabsGestao" class="tabs" style="margin-bottom: 1.5rem;">
            <button class="tab-btn active" onclick="switchGestaoTab('financeiro')">💰 Financeiro</button>
            <button class="tab-btn" onclick="switchGestaoTab('clientes')">📊 Clientes</button>
        </div>
        
        <div id="tabFinanceiro" class="tab-content active">
            ${conteudoOriginal}
        </div>
        
        <div id="tabClientes" class="tab-content" style="display: none;">
            <div class="tabs sub-tabs" style="margin-bottom: 1rem;">
                <button class="tab-btn active" onclick="switchClientesSubTab('analise')">📊 Análise</button>
                <button class="tab-btn" onclick="switchClientesSubTab('lembretes')">💬 Lembretes</button>
            </div>
            
            <div id="subTabAnalise" class="sub-tab-content active">
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                    <div class="stat-card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">Total Clientes</h4>
                        <div id="statTotalClientes" style="font-size: 2rem; font-weight: bold; color: var(--primary-purple);">-</div>
                    </div>
                    <div class="stat-card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">Pacotes Ativos</h4>
                        <div id="statPacotesAtivos" style="font-size: 2rem; font-weight: bold; color: var(--primary-gold);">-</div>
                    </div>
                    <div class="stat-card" style="padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">
                        <h4 style="margin: 0 0 0.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">Receita Pacotes</h4>
                        <div id="statReceitaPacotes" style="font-size: 2rem; font-weight: bold; color: #10B981;">-</div>
                    </div>
                </div>
            </div>
            
            <div id="subTabLembretes" class="sub-tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0;">😴 Clientes Inativos (30+ dias)</h3>
                    <button class="btn-secondary" onclick="abrirEditorTemplates()">📝 Editar Templates</button>
                </div>
                <div id="listaClientesInativos"></div>
            </div>
        </div>
    `;
}

function switchGestaoTab(tab) {
    // Atualizar botões ativos
    document.querySelectorAll('#tabsGestao .tab-btn').forEach(btn => btn.classList.remove('active'));
    const btnFinanceiro = document.getElementById('tabBtnFinanceiro');
    const btnClientes = document.getElementById('tabBtnClientes');

    if (tab === 'financeiro' && btnFinanceiro) btnFinanceiro.classList.add('active');
    if (tab === 'clientes' && btnClientes) btnClientes.classList.add('active');

    // Alternar conteúdo
    const financeiroContent = document.getElementById('financeiroContent');
    const clientesContent = document.getElementById('tabClientes');

    if (financeiroContent) financeiroContent.style.display = tab === 'financeiro' ? 'block' : 'none';
    if (clientesContent) clientesContent.style.display = tab === 'clientes' ? 'block' : 'none';

    // Carregar lembretes quando exibir aba Clientes
    if (tab === 'clientes') {
        carregarClientesInativos();
    }
}

function switchClientesSubTab(subTab) {
    document.querySelectorAll('.sub-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('subTabAnalise').style.display = subTab === 'analise' ? 'block' : 'none';
    document.getElementById('subTabLembretes').style.display = subTab === 'lembretes' ? 'block' : 'none';

    if (subTab === 'analise') {
        carregarAnaliseClientes();
    } else if (subTab === 'lembretes') {
        carregarClientesInativos();
    }
}

// === ANÁLISE DE CLIENTES ===

async function carregarAnaliseClientes() {
    try {
        const response = await fetchComAuth(`${API_URL}/relatorios/clientes/analise`);
        const data = await response.json();

        document.getElementById('statTotalClientes').textContent = data.total_clientes || 0;
        document.getElementById('statPacotesAtivos').textContent = data.pacotes_ativos || 0;
        document.getElementById('statReceitaPacotes').textContent = `R$ ${(data.receita_total_pacotes || 0).toFixed(2)}`;
    } catch (error) {
        console.error('Erro ao carregar análise:', error);
    }
}

// === LEMBRETES WHATSAPP ===

let templatesCache = {};

// Carregar templates do banco de dados
async function carregarTemplates() {
    try {
        const response = await fetchComAuth(`${API_URL}/templates`);
        if (response.ok) {
            const templates = await response.json();
            templates.forEach(t => {
                templatesCache[t.tipo] = t.template;
            });
            console.log('✅ Templates carregados:', Object.keys(templatesCache).length);
        }
    } catch (error) {
        console.error('Erro ao carregar templates:', error);
    }
}

async function carregarClientesInativos() {
    // Carregar templates do banco (se disponíveis)
    await carregarTemplates();

    try {
        const response = await fetchComAuth(`${API_URL}/lembretes`);

        if (!response.ok) {
            throw new Error('Erro ao carregar lembretes');
        }

        const data = await response.json();
        const container = document.getElementById('listaClientesInativos');

        // Contar total de lembretes
        const totalLembretes =
            data.inativos.length +
            data.pagamentos_pendentes.length +
            data.renovacoes.length +
            data.aniversarios.length +
            data.vermifugos.length +
            data.antiparasitarios.length;

        if (totalLembretes === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum lembrete pendente! 🎉</p>';
            return;
        }

        let html = '';

        // 1. Aniversários (prioridade alta - parabenizar!)
        if (data.aniversarios.length > 0) {
            html += renderizarSecaoLembretes('🎂 Aniversários Próximos', data.aniversarios, 'aniversario');
        }

        // 2. Pagamentos Pendentes
        if (data.pagamentos_pendentes.length > 0) {
            html += renderizarSecaoLembretes('💰 Pagamentos Pendentes', data.pagamentos_pendentes, 'pagamento');
        }

        // 3. Renovações de Pacote
        if (data.renovacoes.length > 0) {
            html += renderizarSecaoLembretes('🔄 Renovação de Pacote', data.renovacoes, 'renovacao');
        }

        // 4. Vermífugo
        if (data.vermifugos.length > 0) {
            html += renderizarSecaoLembretes('💊 Vermífugo Vencendo', data.vermifugos, 'vermifugo');
        }

        // 5. Antiparasitário
        if (data.antiparasitarios.length > 0) {
            html += renderizarSecaoLembretes('🐜 Antiparasitário Vencendo', data.antiparasitarios, 'antiparasitario');
        }

        // 6. Clientes Inativos (40+ dias)
        if (data.inativos.length > 0) {
            html += renderizarSecaoLembretes('😴 Clientes Inativos (40+ dias)', data.inativos, 'inativo');
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar lembretes:', error);
        const container = document.getElementById('listaClientesInativos');
        container.innerHTML = '<p class="empty-state" style="color: #EF4444;">Erro ao carregar lembretes.</p>';
    }
}

function renderizarSecaoLembretes(titulo, items, tipo) {
    const cards = items.map(item => renderizarCardLembrete(item, tipo)).join('');

    return `
        <div style="margin-bottom: 2rem;">
            <h4 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1rem;">${titulo} (${items.length})</h4>
            ${cards}
        </div>
    `;
}

function renderizarCardLembrete(item, tipo) {
    let titulo = '', subtitulo = '', badge = '', cor = '';

    switch (tipo) {
        case 'aniversario':
            titulo = item.pet_nome;
            const dataNasc = new Date(item.data_nascimento);
            const idade = new Date().getFullYear() - dataNasc.getFullYear();
            subtitulo = `👤 ${item.tutor_nome} | 📅 ${dataNasc.toLocaleDateString('pt-BR')}`;
            badge = `🎂 ${idade} anos`;
            cor = '#EC4899';
            break;
        case 'pagamento':
            titulo = item.pet_nome;
            subtitulo = `📅 ${new Date(item.data).toLocaleDateString('pt-BR')}`;
            badge = `R$ ${(item.valor_total || 0).toFixed(2)}`;
            cor = item.assinatura_id ? '#7C3AED' : '#EAB308';
            break;
        case 'renovacao':
            titulo = item.nome_plano;
            subtitulo = `👤 ${item.cliente_nome}`;
            badge = `${item.creditos_usados}/${item.creditos_total} créditos`;
            cor = '#7C3AED';
            break;
        case 'vermifugo':
            titulo = item.pet_nome;
            const dataVerm = new Date(item.data_proximo_vermifugo);
            const vencidoVerm = dataVerm < new Date();
            subtitulo = `👤 ${item.tutor_nome}`;
            badge = vencidoVerm ? '⚠️ VENCIDO' : `📅 ${dataVerm.toLocaleDateString('pt-BR')}`;
            cor = vencidoVerm ? '#EF4444' : '#F59E0B';
            break;
        case 'antiparasitario':
            titulo = item.pet_nome;
            const dataAnti = new Date(item.data_proximo_antiparasita);
            const vencidoAnti = dataAnti < new Date();
            subtitulo = `👤 ${item.tutor_nome}`;
            badge = vencidoAnti ? '⚠️ VENCIDO' : `📅 ${dataAnti.toLocaleDateString('pt-BR')}`;
            cor = vencidoAnti ? '#EF4444' : '#F59E0B';
            break;
        case 'inativo':
            titulo = item.tutor_nome;
            const ultimaVisita = item.ultimo_agendamento ? new Date(item.ultimo_agendamento) : null;
            subtitulo = `🐾 ${item.pet_nome}`;
            badge = ultimaVisita ? `📅 ${ultimaVisita.toLocaleDateString('pt-BR')}` : 'Nunca agendou';
            cor = '#6B7280';
            break;
    }

    const telefone = item.telefone ? item.telefone.replace(/\D/g, '') : '';
    const mensagem = gerarMensagem(tipo, item);
    const whatsappLink = telefone ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}` : '';

    return `
        <div style="padding: 1rem; background: var(--bg-card); border: 1px solid var(--border-color); 
                    border-left: 4px solid ${cor}; border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">${titulo}</div>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">${subtitulo}</div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="background: ${cor}20; color: ${cor}; padding: 0.25rem 0.75rem; 
                                 border-radius: 20px; font-size: 0.8rem; font-weight: 500;">${badge}</span>
                    ${whatsappLink ? `
                        <a href="${whatsappLink}" target="_blank" class="btn-primary" 
                           style="padding: 0.4rem 0.75rem; font-size: 0.85rem; text-decoration: none;">
                            💬
                        </a>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function gerarMensagem(tipo, dados) {
    // Templates padrão por tipo
    const defaultTemplates = {
        inativo: 'Olá {nome}! 👋 Sentimos sua falta aqui na Halfeld PetCare! Faz um tempo que não vemos {pet}. Que tal agendar um banho ou tosa? 🐾',
        aniversario: 'Feliz aniversário para {pet}! 🎂🐾 A Halfeld PetCare deseja muitos anos de alegria! Que tal comemorar com um dia de spa?',
        pagamento: 'Olá {nome}! Identificamos um pagamento pendente do atendimento de {pet}. Podemos ajudar? 💰',
        renovacao: 'Olá {nome}! O pacote de {pet} chegou ao fim! 📦 Que tal renovar para continuar aproveitando os benefícios?',
        vermifugo: 'Olá {nome}! O vermífugo de {pet} está vencendo em breve. 💊 Não esqueça de manter a saúde do seu pet em dia!',
        antiparasitario: 'Olá {nome}! O antiparasitário de {pet} precisa ser renovado. 🐜 Entre em contato para mais informações!'
    };

    const template = templatesCache[tipo] || defaultTemplates[tipo] || 'Olá! Entre em contato conosco.';

    return template
        .replace(/{nome}/g, dados.tutor_nome || dados.cliente_nome || '')
        .replace(/{pet}/g, dados.pet_nome || dados.pets || 'seu pet')
        .replace(/{dias}/g, dados.dias_inativo || '')
        .replace(/{creditos}/g, dados.creditos_usados || '')
        .replace(/{pacote}/g, dados.nome_plano || '')
        .replace(/{dias_vencimento}/g, dados.dias_vencimento || '');
}

function copiarMensagem(tutorId) {
    const msgElement = document.getElementById(`msg-${tutorId}`);
    const texto = msgElement.textContent;

    navigator.clipboard.writeText(texto).then(() => {
        mostrarNotificacao('Mensagem copiada! 📋', 'success');
    });
}

async function abrirEditorTemplates() {
    // Carregar templates atuais
    await carregarTemplates();

    const tiposInfo = {
        'inativo': { label: '😴 Cliente Inativo', vars: '{nome}, {pet}, {dias}' },
        'aniversario': { label: '🎂 Aniversário', vars: '{nome}, {pet}, {idade}' },
        'pagamento': { label: '💰 Pagamento Pendente', vars: '{nome}, {pet}, {valor}' },
        'renovacao': { label: '🔄 Renovação Pacote', vars: '{nome}, {pet}, {pacote}, {creditos}' },
        'vermifugo': { label: '💊 Vermífugo', vars: '{nome}, {pet}, {data}' },
        'antiparasitario': { label: '🐜 Antiparasitário', vars: '{nome}, {pet}, {data}' }
    };

    // Templates padrão para fallback
    const defaultTemplates = {
        inativo: 'Olá {nome}! 👋 Sentimos sua falta aqui na Halfeld PetCare! Faz um tempo que não vemos {pet}. Que tal agendar um banho ou tosa? 🐾',
        aniversario: 'Feliz aniversário para {pet}! 🎂🐾 A Halfeld PetCare deseja muitos anos de alegria! Que tal comemorar com um dia de spa?',
        pagamento: 'Olá {nome}! Identificamos um pagamento pendente do atendimento de {pet}. Podemos ajudar? 💰',
        renovacao: 'Olá {nome}! O pacote de {pet} chegou ao fim! 📦 Que tal renovar para continuar aproveitando os benefícios?',
        vermifugo: 'Olá {nome}! O vermífugo de {pet} está vencendo em breve. 💊 Não esqueça de manter a saúde do seu pet em dia!',
        antiparasitario: 'Olá {nome}! O antiparasitário de {pet} precisa ser renovado. 🐜 Entre em contato para mais informações!'
    };

    let htmlTemplates = '';
    for (const [tipo, info] of Object.entries(tiposInfo)) {
        const templateAtual = templatesCache[tipo] || defaultTemplates[tipo] || '';
        htmlTemplates += `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <label style="font-weight: 600;">${info.label}</label>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">Variáveis: ${info.vars}</span>
                </div>
                <textarea id="template_${tipo}" rows="3" 
                    style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); 
                           border-radius: 8px; background: var(--bg-input); color: var(--text-primary); 
                           font-family: inherit; resize: vertical;">${templateAtual}</textarea>
                <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                    <button class="btn-primary" onclick="salvarTemplate('${tipo}')" 
                            style="padding: 0.4rem 1rem; font-size: 0.85rem;">
                        💾 Salvar
                    </button>
                </div>
            </div>
        `;
    }

    // Criar modal
    const modalHtml = `
        <div id="modalEditorTemplates" class="modal active" style="z-index: 1100;">
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2>📝 Editor de Templates WhatsApp</h2>
                    <button class="btn-close" onclick="fecharEditorTemplates()">×</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">
                        Personalize as mensagens enviadas para os tutores. Use as variáveis disponíveis para incluir informações dinâmicas.
                    </p>
                    ${htmlTemplates}
                </div>
            </div>
        </div>
    `;

    // Remover modal anterior se existir
    const modalExistente = document.getElementById('modalEditorTemplates');
    if (modalExistente) modalExistente.remove();

    // Inserir modal no DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharEditorTemplates() {
    const modal = document.getElementById('modalEditorTemplates');
    if (modal) modal.remove();
}

async function salvarTemplate(tipo) {
    const textarea = document.getElementById(`template_${tipo}`);
    const template = textarea.value;

    try {
        const response = await fetchComAuth(`${API_URL}/templates/${tipo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template })
        });

        if (response.ok) {
            templatesCache[tipo] = template;
            mostrarNotificacao('Template salvo com sucesso! ✅', 'success');
        } else {
            const error = await response.json();
            mostrarNotificacao(`Erro ao salvar: ${error.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar template:', error);
        mostrarNotificacao('Erro ao salvar template', 'error');
    }
}

// DESABILITADO - conflita com handler em app.js e reescreve innerHTML
// Event listener para botão Gestão
// document.addEventListener('DOMContentLoaded', function() {
//     const btnFinanceiro = document.getElementById('btnFinanceiro');
//     if (btnFinanceiro) {
//         btnFinanceiro.addEventListener('click', abrirModalGestao);
//         console.log('? Botão Gestão configurado');
//     }
// });


// Fechar modal Gestão
function fecharModalGestao() {
    const modal = document.getElementById('modalFinanceiro');
    if (modal) modal.classList.remove('active');
}
