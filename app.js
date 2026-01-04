// Estado global da aplicação
let state = {
    dataAtual: obterDataHoje(),
    agendamentos: [],
    servicos: [],
    categorias: [],
    servicosPorCategoria: [],
    editandoAgendamento: null,
    modoEdicaoCatalogo: false,
    ws: null,
    senhaFinanceiro: 'halfeld2025', // Senha padrão - pode ser alterada
    currentUser: null
};

// Controle de cliques nos cards da sidebar
let ultimoCardClicado = null;

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação primeiro
    const autenticado = await verificarAutenticacao();
    if (!autenticado) {
        window.location.href = '/login.html';
        return;
    }

    inicializarEventos();
    inicializarWebSocket();
    await carregarDados();

    // Inicializar autocomplete de pets
    inicializarAutocompletePets();

    // Inicializar tabs do financeiro
    if (typeof inicializarFinanceiroTabs === 'function') {
        console.log('Inicializando tabs do financeiro...');
        inicializarFinanceiroTabs();
    }

    // Verificar alarmes a cada minuto
    setInterval(() => {
        verificarAlarmes(state.agendamentos);
    }, 60000);
});

// ========== AUTENTICAÇÃO ==========
async function verificarAutenticacao() {
    try {
        const response = await fetch(`${API_URL}/auth/check`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            state.currentUser = data.user;
            atualizarInfoUsuario();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        return false;
    }
}

function atualizarInfoUsuario() {
    if (state.currentUser) {
        const infoEl = document.getElementById('userInfo');
        if (infoEl) {
            // Exibir primeiro nome + função em 2 linhas
            const primeiroNome = state.currentUser.nomeCompleto
                ? state.currentUser.nomeCompleto.split(' ')[0]
                : state.currentUser.username;
            const funcao = state.currentUser.funcao || 'Usuário';

            infoEl.innerHTML = `
                <div style="text-align: right; line-height: 1.3;">
                    <div style="font-weight: 600; color: var(--primary-gold);">${primeiroNome}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${funcao}</div>
                </div>
            `;
        }

        // Controlar visão de unidade baseado em role
        const isAdmin = state.currentUser.role === 'admin';
        const selectorContainer = document.getElementById('unidadeSelectorContainer');
        const badgeContainer = document.getElementById('unidadeBadgeContainer');
        const adminButtons = document.getElementById('adminButtonsContainer');
        const btnNovo = document.getElementById('btnNovo');

        if (selectorContainer && badgeContainer) {
            if (isAdmin) {
                // Admin vê seletor de unidade
                selectorContainer.style.display = 'block';
                badgeContainer.style.display = 'none';
            } else {
                // Usuário comum vê badge fixo
                selectorContainer.style.display = 'none';
                badgeContainer.style.display = 'block';
                const badge = document.getElementById('unidadeBadge');
                if (badge && state.currentUser.unidadeId) {
                    badge.textContent = `📍 Unidade ${String(state.currentUser.unidadeId).padStart(2, '0')}`;
                }
            }
        }

        // Mostrar botões de admin/gerente
        if (adminButtons) {
            const isGerente = state.currentUser.role === 'gerente';

            // Container visível para Admin ou Gerente
            adminButtons.style.display = (isAdmin || isGerente) ? 'flex' : 'none';

            // Controle individual dos botões
            const btnUsuarios = document.getElementById('btnUsuarios');
            const btnFinanceiro = document.getElementById('btnFinanceiro');
            const btnCaixa = document.getElementById('btnCaixa');
            const btnMobileCaixa = document.getElementById('btnMobileCaixa');

            // Usuários: Apenas Admin
            if (btnUsuarios) btnUsuarios.style.display = isAdmin ? 'block' : 'none';

            // Financeiro: Apenas Admin (Gerente é sem acesso financeiro por padrão nesta regra)
            if (btnFinanceiro) btnFinanceiro.style.display = isAdmin ? 'block' : 'none';

            // Caixa: Admin e Gerente
            if (btnCaixa) btnCaixa.style.display = (isAdmin || isGerente) ? 'block' : 'none';

            // Botão Mobile Caixa
            if (btnMobileCaixa) {
                btnMobileCaixa.style.display = (isAdmin || isGerente) ? 'flex' : 'none';
            }
        }

        // Controlar botão "Novo Agendamento"
        // Apenas Admin e Gerente podem criar agendamentos
        if (btnNovo) {
            const canCreate = isAdmin || state.currentUser.role === 'gerente';
            btnNovo.style.display = canCreate ? 'block' : 'none';
        }

        // Event listener do seletor de unidade
        const unidadeSelector = document.getElementById('unidadeSelector');
        if (unidadeSelector && isAdmin && !unidadeSelector.dataset.listenerAdded) {
            unidadeSelector.addEventListener('change', () => {
                carregarAgendamentos();
            });
            unidadeSelector.dataset.listenerAdded = 'true';
        }
    }
}


async function fazerLogout() {
    if (!confirm('Deseja sair do sistema?')) return;

    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = '/login.html';
    }
}

// ========== WEBSOCKET ==========
function inicializarWebSocket() {
    const wsUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'ws://localhost:3000'
        : `wss://${window.location.host}`;
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        console.log('✓ Conectado ao servidor em tempo real');
    };

    state.ws.onmessage = (event) => {
        const mensagem = JSON.parse(event.data);
        handleWebSocketMessage(mensagem);
    };

    state.ws.onerror = (error) => {
        console.error('Erro WebSocket:', error);
    };

    state.ws.onclose = () => {
        console.log('Conexão WebSocket fechada. Reconectando...');
        setTimeout(inicializarWebSocket, 3000);
    };
}

function handleWebSocketMessage(mensagem) {
    switch (mensagem.type) {
        case 'AGENDAMENTO_CRIADO':
        case 'AGENDAMENTO_ATUALIZADO':
        case 'AGENDAMENTO_EXCLUIDO':
        case 'PRECO_ATUALIZADO':
        case 'SERVICO_ADICIONADO':
            carregarAgendamentos();
            break;
    }
}

// ========== CARREGAR DADOS ==========
async function carregarDados() {
    mostrarLoading(true);
    try {
        await Promise.all([
            carregarCategorias(),
            carregarServicos(),
            carregarServicosPorCategoria(),
            carregarAgendamentos()
        ]);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        // Se for 401, redirecionar para login
        if (error.status === 401 || (error.message && error.message.includes('401'))) {
            window.location.href = '/login.html';
        } else {
            mostrarNotificacao('Erro ao carregar dados. Verifique se o servidor está rodando.', 'error');
        }
    } finally {
        mostrarLoading(false);
    }
}

// Função helper para fazer fetch com tratamento de erros de autenticação
async function fetchComAuth(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Não autenticado');
    }

    return response;
}

async function carregarCategorias() {
    const response = await fetchComAuth(`${API_URL}/categorias`);
    state.categorias = await response.json();
}

async function carregarServicos() {
    const response = await fetchComAuth(`${API_URL}/servicos`);
    state.servicos = await response.json();
    renderizarServicosFormulario();
}

async function carregarServicosPorCategoria() {
    const response = await fetchComAuth(`${API_URL}/servicos/por-categoria`);
    state.servicosPorCategoria = await response.json();
}

async function carregarAgendamentos() {
    // Obter unidade selecionada (se admin) ou do usuário
    let unidadeParam = '';
    if (state.currentUser) {
        if (state.currentUser.role === 'admin') {
            const selector = document.getElementById('unidadeSelector');
            if (selector && selector.value) {
                unidadeParam = `&unidade=${selector.value}`;
            }
        } else if (state.currentUser.unidadeId) {
            unidadeParam = `&unidade=${state.currentUser.unidadeId}`;
        }
    }

    const response = await fetchComAuth(`${API_URL}/agendamentos?data=${state.dataAtual}${unidadeParam}`);
    state.agendamentos = await response.json();
    renderizarTimeline();
    renderizarListaAgendamentos();
}

// ========== HELPER: OBTER UNIDADE ATUAL ==========
function obterUnidadeAtual() {
    if (!state.currentUser) return 1; // Fallback

    // Se for admin, pega do seletor
    if (state.currentUser.role === 'admin') {
        const selector = document.getElementById('unidadeSelector');
        const unidadeSelecionada = selector ? selector.value : '';
        // Se não selecionou nenhuma (todas), usa Unidade 1 como padrão
        return unidadeSelecionada ? parseInt(unidadeSelecionada) : 1;
    }

    // Se for usuário comum, usa a unidade dele
    return state.currentUser.unidadeId || 1;
}

// ========== TABS NOVO AGENDAMENTO (Avulso/Assinatura) ==========
function switchAgendamentoTab(tab) {
    // Atualizar botões ativos
    const btnAvulso = document.getElementById('tabBtnAvulso');
    const btnAssinatura = document.getElementById('tabBtnAssinatura');
    const tabAvulso = document.getElementById('tabAvulsoContent');
    const tabAssinatura = document.getElementById('tabAssinaturaContent');

    if (btnAvulso) btnAvulso.classList.toggle('active', tab === 'avulso');
    if (btnAssinatura) btnAssinatura.classList.toggle('active', tab === 'assinatura');

    // Alternar conteúdo
    if (tabAvulso) tabAvulso.style.display = tab === 'avulso' ? 'block' : 'none';
    if (tabAssinatura) tabAssinatura.style.display = tab === 'assinatura' ? 'block' : 'none';

    // Se entrar na aba de assinatura, carregar lista
    if (tab === 'assinatura') {
        carregarAssinaturasParaModal();
    }
}

async function carregarAssinaturasParaModal() {
    // Usa a mesma função do pacotes.js para carregar e renderizar
    if (typeof carregarTodasAssinaturasAtivas === 'function') {
        await carregarTodasAssinaturasAtivas();
    }
}

function abrirVendaAssinaturaFromModal() {
    // Fechar modal de agendamento e abrir modal de seleção cliente para venda
    document.getElementById('modalAgendamento').classList.remove('active');
    if (typeof abrirModalSelecaoClienteVenda === 'function') {
        abrirModalSelecaoClienteVenda();
    }
}

function abrirVisualizarPacotesFromModal() {
    // Fechar modal de agendamento e abrir modal de gestão de pacotes
    document.getElementById('modalAgendamento').classList.remove('active');
    if (typeof abrirModalGerenciarPacotes === 'function') {
        abrirModalGerenciarPacotes();
    }
}

// ========== EVENTOS ==========
function inicializarEventos() {
    console.log('🔧 [DEBUG] Iniciando inicializarEventos()...');
    // Data
    const currentDateEl = document.getElementById('currentDate');
    currentDateEl.value = state.dataAtual;
    currentDateEl.addEventListener('change', (e) => {
        state.dataAtual = e.target.value;
        carregarAgendamentos();
    });

    document.getElementById('btnPrevDay').addEventListener('click', () => {
        state.dataAtual = adicionarDias(state.dataAtual, -1);
        document.getElementById('currentDate').value = state.dataAtual;
        carregarAgendamentos();
    });

    document.getElementById('btnNextDay').addEventListener('click', () => {
        state.dataAtual = adicionarDias(state.dataAtual, 1);
        document.getElementById('currentDate').value = state.dataAtual;
        carregarAgendamentos();
    });

    document.getElementById('btnToday').addEventListener('click', () => {
        state.dataAtual = obterDataHoje();
        document.getElementById('currentDate').value = state.dataAtual;
        carregarAgendamentos();
    });

    // Modais
    document.getElementById('btnNovo').addEventListener('click', () => {
        state.editandoAgendamento = null;
        abrirModalAgendamento();
    });

    document.getElementById('btnCatalogo').addEventListener('click', abrirModalCatalogo);
    document.getElementById('btnClientes').addEventListener('click', abrirModalClientes);
    const btnUsu = document.getElementById('btnUsuarios');
    if (btnUsu) btnUsu.addEventListener('click', abrirModalUsuarios);

    // Botão financeiro - listener sempre adicionado, mas visibilidade controlada por atualizarInfoUsuario()
    const btnFinanceiro = document.getElementById('btnFinanceiro');
    if (btnFinanceiro) {
        btnFinanceiro.addEventListener('click', abrirModalFinanceiro);
    }

    document.getElementById('btnCloseModal').addEventListener('click', fecharModalAgendamento);
    document.getElementById('btnCloseCatalogo').addEventListener('click', fecharModalCatalogo);
    document.getElementById('btnCloseFinanceiro').addEventListener('click', fecharModalFinanceiro);
    document.getElementById('btnCancelar').addEventListener('click', fecharModalAgendamento);
    document.getElementById('btnExcluirAgendamento').addEventListener('click', () => {
        if (state.editandoAgendamento) {
            excluirAgendamento(state.editandoAgendamento.id);
        }
    });

    // Formulário
    document.getElementById('formAgendamento').addEventListener('submit', salvarAgendamento);

    // Busca
    document.getElementById('searchPet').addEventListener('input', (e) => {
        filtrarAgendamentos(e.target.value);
    });

    document.getElementById('searchCatalogo').addEventListener('input', (e) => {
        filtrarCatalogo(e.target.value);
    });

    // Modo edição catálogo
    document.getElementById('btnEditMode').addEventListener('click', () => {
        state.modoEdicaoCatalogo = !state.modoEdicaoCatalogo;
        const btn = document.getElementById('btnEditMode');
        btn.textContent = state.modoEdicaoCatalogo ? '👁️ Modo Visualização' : '✏️ Modo Edição';
        btn.classList.toggle('btn-primary');
        renderizarCatalogo();
    });

    // Botão adicionar serviço extra
    document.getElementById('btnAddServicoExtra').addEventListener('click', () => adicionarServicoExtra());

    // Desconto percentual toggle
    document.getElementById('descontoPercentual').addEventListener('change', atualizarLabelDesconto);

    // Atualizar valores quando mudar desconto
    document.getElementById('descontoValor').addEventListener('input', calcularValorTotal);

    // Atualizar valores quando mudar Taxi Dog
    document.getElementById('taxiBuscar').addEventListener('change', calcularValorTotal);
    document.getElementById('taxiLevar').addEventListener('change', calcularValorTotal);

    // Alterações nos seletores de data financeiro (com verificação de existência)
    const financeiroData = document.getElementById('financeiroData');
    const financeiroMes = document.getElementById('financeiroMes');
    const financeiroAno = document.getElementById('financeiroAno');
    const financeiroAnoAnual = document.getElementById('financeiroAnoAnual');

    if (financeiroData) financeiroData.addEventListener('change', carregarRelatorioFinanceiroComUnidade);
    if (financeiroMes) financeiroMes.addEventListener('change', carregarRelatorioFinanceiroComUnidade);
    if (financeiroAno) financeiroAno.addEventListener('input', carregarRelatorioFinanceiroComUnidade);
    if (financeiroAnoAnual) financeiroAnoAnual.addEventListener('input', carregarRelatorioFinanceiroComUnidade);

    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// ========== TIMELINE ==========
let currentDate = { toISOString: () => state.dataAtual + 'T00:00:00' };

function renderizarTimeline() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    const horarios = gerarHorarios();

    horarios.forEach(horario => {
        // Label de hora
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = horario;
        timeline.appendChild(timeLabel);

        // Slot de hora
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.dataset.horario = horario;

        // Encontrar agendamentos para este horário
        const agendamentosNoHorario = state.agendamentos.filter(agend => {
            return agend.hora_inicio === horario + ':00';
        });

        agendamentosNoHorario.forEach(agend => {
            const block = criarBlocoAgendamento(agend);
            timeSlot.appendChild(block);
        });

        timeline.appendChild(timeSlot);
    });

    // Click-to-Schedule: adicionar listeners em slots vazios
    adicionarClickListeners();
}

// Adicionar click listeners para criar agendamentos ao clicar em horários vazios
function adicionarClickListeners() {
    const timeSlots = document.querySelectorAll('.time-slot');

    timeSlots.forEach(slot => {
        const appointmentBlocks = slot.querySelectorAll('.appointment-block');

        // Só adicionar click se slot estiver vazio (sem agendamentos)
        if (appointmentBlocks.length === 0) {
            slot.addEventListener('click', () => {
                const horario = slot.dataset.horario;
                abrirModalComHorario(horario);
            });
            slot.style.cursor = 'pointer';
            slot.title = 'Clique para agendar';
        }
    });
}

// Abrir modal de agendamento com horário pré-preenchido
function abrirModalComHorario(horario) {
    state.editandoAgendamento = null;
    abrirModalAgendamento();

    // Pré-preencher data atual e hora clicada
    document.getElementById('agendData').value = state.dataAtual;
    document.getElementById('agendHora').value = horario;
}

function criarBlocoAgendamento(agendamento) {
    const block = document.createElement('div');
    block.className = 'appointment-block';
    block.dataset.agendamentoId = agendamento.id; // ID para localização

    // Parse servicos se vier como string
    let servicos = agendamento.servicos;
    if (typeof servicos === 'string') {
        try { servicos = JSON.parse(servicos); } catch (e) { servicos = []; }
    }
    if (!Array.isArray(servicos)) servicos = [];

    // Verificar se é Premium (serviços especiais)
    const isPremium = verificarServicosPremium(servicos);

    // Taxi sobrepõe Premium
    if (agendamento.taxi_buscar || agendamento.taxi_levar) {
        block.classList.add('taxi');
    } else if (isPremium) {
        block.classList.add('premium');
    }

    const taxiIcon = (agendamento.taxi_buscar || agendamento.taxi_levar) ? '🚗 ' : '';

    const servicosTexto = servicos
        .map(s => `<span class="service-tag">${s.nome || s}</span>`)
        .join(' ');

    // Badge de assinatura para timeline
    const assinaturaBadge = agendamento.assinatura_id
        ? '<span style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; font-weight: 700; margin-left: 4px;">ASSIN.</span>'
        : '';

    // Badge de extras para timeline
    const extrasBadge = (agendamento.extras_valor && agendamento.extras_valor > 0)
        ? '<span style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; font-weight: 600; margin-left: 4px;">+EXTRA</span>'
        : '';

    block.innerHTML = `
        <div class="appointment-pet-name">${taxiIcon}${agendamento.pet_nome}${assinaturaBadge}${extrasBadge}</div>
        <div class="appointment-services">${servicosTexto}</div>
    `;

    // Implementar duplo-click: 1º scroll para sidebar, 2º abre modal
    block.addEventListener('click', () => {
        if (ultimoBlocoClicado === agendamento.id) {
            // SEGUNDO CLIQUE: Abrir modal de edição
            editarAgendamento(agendamento);
            ultimoBlocoClicado = null;
        } else {
            // PRIMEIRO CLIQUE: Scroll e destaque no sidebar
            scrollParaSidebarCard(agendamento);
            ultimoBlocoClicado = agendamento.id;
        }
    });

    return block;
}

// Variável para rastrear último bloco clicado (timeline)
let ultimoBlocoClicado = null;

// Função para scroll e destaque no card do sidebar
function scrollParaSidebarCard(agendamento) {
    const lista = document.getElementById('appointmentsList');
    if (!lista) return;

    const cards = lista.querySelectorAll('.appointment-card');
    cards.forEach((card, index) => {
        card.classList.remove('destacado');
    });

    // Encontrar o card correspondente pelo índice
    const agendamentosOrdenados = [...state.agendamentos].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    const idx = agendamentosOrdenados.findIndex(a => a.id === agendamento.id);

    if (idx >= 0 && cards[idx]) {
        cards[idx].classList.add('destacado');
        cards[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Remover destaque após 2 segundos
        setTimeout(() => cards[idx].classList.remove('destacado'), 2000);
    }
}

// Função para scroll e destaque ao clicar no card da sidebar
function scrollEDestacarAgendamento(agendamento) {
    // Encontrar o bloco na timeline pelo ID
    const blocos = document.querySelectorAll('.appointment-block');
    let blocoAlvo = null;

    blocos.forEach(bloco => {
        const blocoId = bloco.dataset.agendamentoId;
        if (blocoId && parseInt(blocoId) === agendamento.id) {
            blocoAlvo = bloco;
        }
    });

    if (!blocoAlvo) return;

    // Scroll suave até o bloco
    blocoAlvo.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    // Aplicar classe de destaque temporário
    blocoAlvo.classList.add('destacado');

    // Remover destaque após 2 segundos
    setTimeout(() => {
        blocoAlvo.classList.remove('destacado');
    }, 2000);
}

// Função helper para verificar serviços Premium
function verificarServicosPremium(servicos) {
    // Safety check: ensure servicos is an array
    if (!servicos) return false;

    // If servicos is a string (from database), try to parse it
    if (typeof servicos === 'string') {
        try {
            servicos = JSON.parse(servicos);
        } catch (e) {
            return false;
        }
    }

    // Final check: must be an array
    if (!Array.isArray(servicos)) return false;

    const servicosPremium = [
        'Premium', 'Banho Premium', 'Tosa Avançada', 'Tosa Específica',
        'Hidratação', 'Escovação de Dentes'
    ];

    return servicos.some(servico =>
        servicosPremium.some(premium =>
            servico.nome && servico.nome.toLowerCase().includes(premium.toLowerCase())
        ) ||
        (servico.categoria_nome &&
            (servico.categoria_nome.includes('Avançada') ||
                servico.categoria_nome.includes('Específica') ||
                servico.categoria_nome.includes('Especiais')))
    );
}

// ========== LISTA DE AGENDAMENTOS ==========
function renderizarListaAgendamentos() {
    const lista = document.getElementById('appointmentsList');
    const searchInput = document.getElementById('searchPet');

    if (!lista) {
        return;
    }

    // Limpar campo de busca ao renderizar (previne autocomplete)
    if (searchInput) {
        searchInput.value = '';
    }

    if (!state.agendamentos || state.agendamentos.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhum agendamento para este dia</p>';
        return;
    }

    // Ordenar e guardar referência
    const agendamentosOrdenados = [...state.agendamentos].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

    lista.innerHTML = agendamentosOrdenados
        .map(agend => criarCardAgendamento(agend))
        .join('');

    // Garantir visibilidade dos cards (proteção contra filtros)
    setTimeout(() => {
        document.querySelectorAll('.appointment-card').forEach(card => {
            card.style.display = 'block';
        });
    }, 50);

    // Adicionar eventos de clique usando os agendamentos ordenados
    lista.querySelectorAll('.appointment-card').forEach((card, index) => {
        card.addEventListener('click', () => {
            const agendamento = agendamentosOrdenados[index];

            // Verificar se é o mesmo card clicado anteriormente
            if (ultimoCardClicado === agendamento.id) {
                // SEGUNDO CLIQUE: Abrir modal de edição
                editarAgendamento(agendamento);
                ultimoCardClicado = null; // Resetar para próximo ciclo
            } else {
                // PRIMEIRO CLIQUE: Scroll e destaque apenas
                scrollEDestacarAgendamento(agendamento);
                ultimoCardClicado = agendamento.id; // Marcar como clicado
            }
        });
    });
}

function criarCardAgendamento(agendamento) {
    // Parse servicos se vier como string
    let servicos = agendamento.servicos;
    if (typeof servicos === 'string') {
        try { servicos = JSON.parse(servicos); } catch (e) { servicos = []; }
    }
    if (!Array.isArray(servicos)) servicos = [];

    const taxiClass = (agendamento.taxi_buscar || agendamento.taxi_levar) ? 'taxi' : '';
    const servicosTexto = servicos.map(s => s.nome || s).join(', ');

    // Observações
    const observacoesHtml = agendamento.observacoes
        ? `<div class="appointment-obs">${agendamento.observacoes}</div>`
        : '';

    // Informações do Tutor (se disponível)
    let tutorInfoHtml = '';
    if (agendamento.tutor_nome) {
        const dadosTutor = JSON.stringify({
            nome: agendamento.tutor_nome,
            telefone: agendamento.tutor_telefone || 'Não informado',
            endereco: agendamento.tutor_endereco || 'Não informado'
        }).replace(/"/g, '&quot;');

        tutorInfoHtml = `
            <div class="appointment-tutor-info">
                <div class="tutor-name-row">
                    <span class="tutor-name">👤 ${agendamento.tutor_nome}</span>
                    <button class="btn-ver-endereco" 
                            onclick="event.stopPropagation(); mostrarEnderecoPopup(${dadosTutor});" 
                            title="Ver informações de contato">
                        📍 Ver Endereço
                    </button>
                </div>
            </div>
        `;
    }

    // Botão de pagamento com cores por forma
    let statusPagamento, textoPagamento;

    // DEBUG: Ver o que está vindo do banco
    if (agendamento.pago) {
        console.log(`Agendamento ${agendamento.id}: pago=${agendamento.pago}, forma_pagamento='${agendamento.forma_pagamento}'`);
    }

    if (agendamento.pago) {
        const formas = {
            'dinheiro': { class: 'pago-dinheiro', texto: 'Pago Dinheiro' },
            'pix': { class: 'pago-pix', texto: 'Pago Pix' },
            'cartao': { class: 'pago-cartao', texto: 'Pago Cartão' }
        };

        // Se forma_pagamento for undefined/null, assumir 'dinheiro' (agendamentos antigos)
        const formaPagamento = agendamento.forma_pagamento || 'dinheiro';
        const forma = formas[formaPagamento] || { class: 'pago-dinheiro', texto: 'Pago Dinheiro' };
        statusPagamento = forma.class;
        textoPagamento = forma.texto;
    } else {
        statusPagamento = 'a-receber';
        textoPagamento = 'À Receber';
    }

    const valorTotal = agendamento.valor_total || 0;

    // Badge de assinatura
    const assinaturaBadge = agendamento.assinatura_id
        ? '<span class="badge-assinatura" style="background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%); color: white; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 0.5rem;">ASSINATURA</span>'
        : '';

    // Badge de extras (para pacotes com serviço extra)
    let extrasBadge = '';
    if (agendamento.extras_valor && agendamento.extras_valor > 0) {
        const extrasPago = agendamento.extras_pago;
        const extrasColor = extrasPago ? '#10B981' : '#F59E0B';
        const extrasIcon = extrasPago ? '✅' : '⏳';
        extrasBadge = `
            <span class="badge-extras" onclick="event.stopPropagation(); ${extrasPago ? '' : `pagarExtras(${agendamento.id}, '${(agendamento.extras_descricao || '').replace(/'/g, "\\'")}', ${agendamento.extras_valor})`}" 
                  style="background: ${extrasColor}20; color: ${extrasColor}; font-size: 0.7rem; padding: 3px 8px; border-radius: 4px; font-weight: 600; cursor: ${extrasPago ? 'default' : 'pointer'}; display: inline-flex; align-items: center; gap: 3px; margin-left: 0.5rem;">
                ${extrasIcon} ${formatarMoeda(agendamento.extras_valor)}
            </span>
        `;
    }

    // Botão de pagamento/extras
    let pagamentoHtml = '';

    if (agendamento.assinatura_id) {
        // Para assinaturas: mostrar +Extra ou botão de pagamento de extras
        if (agendamento.extras_valor && agendamento.extras_valor > 0) {
            // Já tem extras - mostrar botão de pagamento
            const extrasPago = agendamento.extras_pago;
            const statusExtras = extrasPago ? 'pago' : 'a-receber';
            const textoExtras = extrasPago ? 'Extra Pago' : 'À Receber';
            pagamentoHtml = `
                <div class="appointment-payment">
                    <button class="btn-payment ${statusExtras}" onclick="event.stopPropagation(); ${extrasPago ? '' : `pagarExtras(${agendamento.id}, '${(agendamento.extras_descricao || '').replace(/'/g, "\\'")}', ${agendamento.extras_valor})`}" ${extrasPago ? 'style="cursor: default;"' : ''}>
                        <span class="btn-payment-status">${textoExtras}</span>
                        <span class="btn-payment-value">${formatarMoeda(agendamento.extras_valor)}</span>
                    </button>
                </div>
            `;
        } else {
            // Sem extras - mostrar botão +Extra
            pagamentoHtml = `
                <div class="appointment-payment">
                    <button class="btn-payment btn-extra" onclick="event.stopPropagation(); abrirModalAdicionarExtra(${agendamento.id})" 
                            style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white;">
                        <span class="btn-payment-status">+ Extra</span>
                        <span class="btn-payment-value" style="font-size: 0.7rem;">Adicionar</span>
                    </button>
                </div>
            `;
        }
    } else {
        // Para avulsos: botão de pagamento normal
        pagamentoHtml = `
            <div class="appointment-payment">
                <button class="btn-payment ${statusPagamento}" onclick="event.stopPropagation(); togglePagamento(${agendamento.id}, ${agendamento.pago}, '${agendamento.forma_pagamento || ''}')">
                    <span class="btn-payment-status">${textoPagamento}</span>
                    <span class="btn-payment-value">${formatarMoeda(valorTotal)}</span>
                </button>
            </div>
        `;
    }


    return `
        <div class="appointment-card ${taxiClass}">
            <div class="appointment-card-header">
                <span class="appointment-time">${formatarHora(agendamento.hora_inicio)}</span>
                ${assinaturaBadge}${extrasBadge}
            </div>
            <div class="appointment-card-body">
                <div class="appointment-card-pet">${agendamento.pet_nome}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">${servicosTexto}</div>
                ${observacoesHtml}
                ${tutorInfoHtml}
                ${pagamentoHtml}
            </div>
        </div>
    `;
}

function filtrarAgendamentos(termo) {
    const cards = document.querySelectorAll('.appointment-card');

    // Se termo está vazio, mostrar todos
    if (!termo || termo.trim() === '') {
        cards.forEach(card => {
            card.style.display = 'block';
        });
        return;
    }

    const termoLower = termo.toLowerCase();

    cards.forEach(card => {
        const texto = card.textContent.toLowerCase();
        card.style.display = texto.includes(termoLower) ? 'block' : 'none';
    });
}

// ========== MODAL AGENDAMENTO ==========
function abrirModalAgendamento() {
    const modal = document.getElementById('modalAgendamento');
    const form = document.getElementById('formAgendamento');

    form.reset();
    limparServicosExtras();

    // IMPORTANTE: Limpar seleções de serviços
    document.querySelectorAll('.service-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Limpar container de valores
    document.getElementById('valoresServicos').innerHTML = '<p style="color: var(--text-secondary); padding: 1rem; text-align: center;">Selecione serviços acima</p>';

    // Resetar valores totais
    document.getElementById('valorSubtotal').textContent = 'R$ 0,00';
    document.getElementById('valorDesconto').textContent = 'R$ 0,00';
    document.getElementById('valorTotal').textContent = 'R$ 0,00';

    if (state.editandoAgendamento) {
        document.getElementById('modalTitle').textContent = 'Editar Agendamento';
        document.getElementById('btnExcluirAgendamento').style.display = 'inline-block';
        preencherFormulario(state.editandoAgendamento);
    } else {
        document.getElementById('modalTitle').textContent = 'Novo Agendamento';
        document.getElementById('btnExcluirAgendamento').style.display = 'none';
        document.getElementById('agendData').value = state.dataAtual;
    }

    modal.classList.add('active');

    // Scroll to top do modal
    setTimeout(() => {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    }, 50);
}

function fecharModalAgendamento() {
    document.getElementById('modalAgendamento').classList.remove('active');
    state.editandoAgendamento = null;
    // Limpar dataset de assinatura e modo assinatura
    const petNome = document.getElementById('petNome');
    if (petNome) {
        delete petNome.dataset.assinaturaId;
        delete petNome.dataset.creditosRestantes;
    }
    // Limpar modo assinatura
    document.getElementById('formAgendamento')?.removeAttribute('data-assinatura-mode');
    // Resetar repetidor
    const repeater = document.getElementById('repeaterEnabled');
    if (repeater) {
        repeater.checked = false;
        const options = document.getElementById('repeaterOptions');
        if (options) options.style.display = 'none';
    }
    // Resetar Sem Custo
    const servicosSemCusto = document.getElementById('servicosSemCusto');
    if (servicosSemCusto) servicosSemCusto.checked = false;
    const taxiSemCusto = document.getElementById('taxiSemCusto');
    if (taxiSemCusto) taxiSemCusto.checked = false;

    // Resetar busca tutor/pet
    const tutorBusca = document.getElementById('tutorBusca');
    if (tutorBusca) tutorBusca.value = '';
    const tutorId = document.getElementById('tutorId');
    if (tutorId) tutorId.value = '';
    const tutorResultados = document.getElementById('tutorResultados');
    if (tutorResultados) tutorResultados.style.display = 'none';
    const petsSelecionados = document.getElementById('petsSelecionados');
    if (petsSelecionados) petsSelecionados.style.display = 'none';
    const listaPetsCheckbox = document.getElementById('listaPetsCheckbox');
    if (listaPetsCheckbox) listaPetsCheckbox.innerHTML = '';
    const petInfo = document.getElementById('petInfo');
    if (petInfo) petInfo.innerHTML = '';
}

// ========== BUSCA TUTOR/PET ==========
let tutoresBuscaTimeout = null;
let petsTutorAtual = [];

async function buscarTutores(termo) {
    clearTimeout(tutoresBuscaTimeout);
    const container = document.getElementById('tutorResultados');

    if (!termo || termo.length < 2) {
        container.style.display = 'none';
        return;
    }

    tutoresBuscaTimeout = setTimeout(async () => {
        try {
            const response = await fetchComAuth(`${API_URL}/tutores?busca=${encodeURIComponent(termo)}`);
            const tutores = await response.json();

            if (tutores.length === 0) {
                container.innerHTML = '<div style="padding: 0.5rem; color: var(--text-secondary);">Nenhum tutor encontrado</div>';
            } else {
                container.innerHTML = tutores.map(t => `
                    <div class="autocomplete-item" onclick="selecionarTutor(${t.id}, '${t.nome.replace(/'/g, "\\'")}')">
                        <strong>${t.nome}</strong>
                        <span style="color: var(--text-secondary); font-size: 0.85rem;">${t.telefone || ''}</span>
                    </div>
                `).join('');
            }
            container.style.display = 'block';
        } catch (e) {
            console.error('Erro ao buscar tutores:', e);
        }
    }, 300);
}

async function selecionarTutor(tutorId, tutorNome) {
    document.getElementById('tutorBusca').value = tutorNome;
    document.getElementById('tutorId').value = tutorId;
    document.getElementById('tutorResultados').style.display = 'none';

    // Buscar pets do tutor
    try {
        const response = await fetchComAuth(`${API_URL}/pets/tutor/${tutorId}`);
        petsTutorAtual = await response.json();

        mostrarPetsTutor(petsTutorAtual);
    } catch (e) {
        console.error('Erro ao buscar pets:', e);
        petsTutorAtual = [];
    }
}

function mostrarPetsTutor(pets) {
    const container = document.getElementById('listaPetsCheckbox');
    const section = document.getElementById('petsSelecionados');

    if (!pets || pets.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Nenhum pet cadastrado para este tutor.</p>';
        section.style.display = 'block';
        return;
    }

    container.innerHTML = pets.map(p => `
        <label class="checkbox-label pet-checkbox-item" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 0.5rem;">
            <input type="checkbox" name="petCheckbox" value="${p.id}" data-nome="${p.nome}" class="form-checkbox" onchange="atualizarPetNome()">
            <span style="margin-left: 0.5rem;">
                <strong>${p.nome}</strong>
                <span style="color: var(--text-secondary); font-size: 0.85rem;">(${p.especie || 'Pet'}${p.raca ? ' - ' + p.raca : ''})</span>
            </span>
        </label>
    `).join('');

    section.style.display = 'block';

    // Se só tem um pet, seleciona automaticamente
    if (pets.length === 1) {
        const checkbox = container.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = true;
            atualizarPetNome();
        }
    }
}

function selecionarTodosPets() {
    const checkboxes = document.querySelectorAll('input[name="petCheckbox"]');
    const todosChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => cb.checked = !todosChecked);
    atualizarPetNome();
}

function atualizarPetNome() {
    const checkboxes = document.querySelectorAll('input[name="petCheckbox"]:checked');
    const nomes = Array.from(checkboxes).map(cb => cb.dataset.nome);
    const ids = Array.from(checkboxes).map(cb => cb.value);

    document.getElementById('petNome').value = nomes.join(', ');
    document.getElementById('petId').value = ids.join(',');

    // Atualizar info preview
    const petInfo = document.getElementById('petInfo');
    if (nomes.length === 0) {
        petInfo.innerHTML = '';
    } else if (nomes.length === 1) {
        const pet = petsTutorAtual.find(p => p.id == ids[0]);
        if (pet) {
            petInfo.innerHTML = `<span style="color: var(--primary-gold);">${pet.nome}</span> - ${pet.especie || 'Pet'} ${pet.raca ? '(' + pet.raca + ')' : ''}`;
        }
    } else {
        petInfo.innerHTML = `<span style="color: var(--primary-gold);">${nomes.length} pets selecionados:</span> ${nomes.join(', ')}`;
    }
}

function preencherFormulario(agendamento) {
    document.getElementById('petNome').value = agendamento.pet_nome;
    document.getElementById('agendData').value = agendamento.data;
    document.getElementById('agendHora').value = agendamento.hora_inicio.substring(0, 5);
    document.getElementById('taxiBuscar').checked = agendamento.taxi_buscar;
    document.getElementById('taxiLevar').checked = agendamento.taxi_levar;
    document.getElementById('observacoes').value = agendamento.observacoes || '';

    // Desconto
    if (agendamento.desconto_tipo === 'percentual') {
        document.getElementById('descontoPercentual').checked = true;
        atualizarLabelDesconto();
    }
    document.getElementById('descontoValor').value = agendamento.desconto_valor || 0;

    // Parse servicos se vier como string
    let servicos = agendamento.servicos;
    if (typeof servicos === 'string') {
        try { servicos = JSON.parse(servicos); } catch (e) { servicos = []; }
    }
    if (!Array.isArray(servicos)) servicos = [];

    // Marcar serviços selecionados
    const servicoIds = servicos.map(s => s.id);
    document.querySelectorAll('.service-item').forEach(item => {
        const id = parseInt(item.dataset.id);
        if (servicoIds.includes(id)) {
            item.classList.add('selected');
        }
    });

    // Renderizar valores dos serviços selecionados
    renderizarValoresServicos();

    // Aguardar renderização dos serviços
    setTimeout(() => {
        // Preencher valores customizados
        if (agendamento.valores_customizados) {
            Object.keys(agendamento.valores_customizados).forEach(servicoId => {
                const input = document.querySelector(`input[data-servico-id="${servicoId}"]`);
                if (input) {
                    input.value = agendamento.valores_customizados[servicoId];
                }
            });
        }

        // Preencher serviços extras
        let servicosExtras = agendamento.servicos_extras;
        if (typeof servicosExtras === 'string') {
            try { servicosExtras = JSON.parse(servicosExtras); } catch (e) { servicosExtras = []; }
        }
        if (!Array.isArray(servicosExtras)) servicosExtras = [];

        if (servicosExtras.length > 0) {
            servicosExtras.forEach(extra => {
                adicionarServicoExtra(extra.descricao, extra.valor);
            });
        }

        calcularValorTotal();
    }, 100);
}

function renderizarServicosFormulario() {
    const container = document.getElementById('servicosList');
    container.innerHTML = state.servicos.map(serv => `
        <div class="service-item" data-id="${serv.id}" onclick="toggleServico(this)">
            <div style="font-weight: 600;">${serv.nome}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${formatarMoeda(serv.preco)} - ${serv.duracao_minutos}min</div>
        </div>
    `).join('');
}

function toggleServico(element) {
    element.classList.toggle('selected');
    renderizarValoresServicos();
    calcularValorTotal();
}

function renderizarValoresServicos() {
    const container = document.getElementById('valoresServicos');
    const servicosSelecionados = obterServicosSelecionados();

    if (servicosSelecionados.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 1rem; text-align: center;">Selecione serviços acima</p>';
        return;
    }

    container.innerHTML = servicosSelecionados.map(serv => `
        <div class="valor-servico-item">
            <label>${serv.nome}</label>
            <input 
                type="number" 
                class="form-input" 
                data-servico-id="${serv.id}" 
                value="${serv.preco}" 
                min="0" 
                step="0.01"
                onchange="calcularValorTotal()"
            >
        </div>
    `).join('');
}

// ========== SERVIÇOS EXTRAS ==========
function adicionarServicoExtra(descricao = '', valor = 0) {
    const container = document.getElementById('servicosExtras');
    const index = container.children.length;

    const div = document.createElement('div');
    div.className = 'servico-extra-item';
    div.innerHTML = `
        <input 
            type="text" 
            class="form-input" 
            placeholder="Descrição do serviço extra" 
            value="${descricao}"
            data-extra-descricao="${index}"
        >
        <input 
            type="number" 
            class="form-input" 
            placeholder="Valor (R$)" 
            value="${valor || ''}"
            min="0" 
            step="5"
            data-extra-valor="${index}"
            oninput="calcularValorTotal()"
        >
        <button type="button" class="btn-remove" onclick="removerServicoExtra(this)">×</button>
    `;

    container.appendChild(div);
    calcularValorTotal();
}

function removerServicoExtra(btn) {
    btn.parentElement.remove();
    calcularValorTotal();
}

function limparServicosExtras() {
    document.getElementById('servicosExtras').innerHTML = '';
}

function obterServicosExtras() {
    const extras = [];
    document.querySelectorAll('.servico-extra-item').forEach((item, index) => {
        const descricao = item.querySelector(`[data-extra-descricao]`).value;
        const valor = parseFloat(item.querySelector(`[data-extra-valor]`).value) || 0;
        extras.push({ descricao, valor });
    });
    return extras;
}

// ========== DESCONTO ==========
function atualizarLabelDesconto() {
    const isPercentual = document.getElementById('descontoPercentual').checked;
    document.getElementById('descontoLabel').textContent = isPercentual ? '%' : 'R$';
    calcularValorTotal();
}

// ========== HELPERS ==========
// Helper para obter valor do serviço Taxi Dog
function obterValorTaxi() {
    const servicoTaxi = state.servicos.find(s => s.categoria_nome === 'Taxi Dog');
    return servicoTaxi ? servicoTaxi.preco : 20;
}

// Helper para obter serviços selecionados no formulário
function obterServicosSelecionados() {
    return Array.from(document.querySelectorAll('.service-item.selected'))
        .map(item => {
            const id = parseInt(item.dataset.id);
            return state.servicos.find(s => s.id === id);
        })
        .filter(s => s !== undefined);
}

// ========== SEM CUSTO ==========
function toggleSemCusto() {
    calcularValorTotal();
}

// ========== CÁLCULOS ==========
function calcularValorTotal() {
    // Verificar se serviços são sem custo
    const servicosSemCusto = document.getElementById('servicosSemCusto')?.checked || false;
    const taxiSemCusto = document.getElementById('taxiSemCusto')?.checked || false;

    // Valores dos serviços (editáveis) - zerar se sem custo
    let subtotal = 0;
    if (!servicosSemCusto) {
        document.querySelectorAll('[data-servico-id]').forEach(input => {
            subtotal += parseFloat(input.value) || 0;
        });

        // Valores dos serviços extras
        document.querySelectorAll('[data-extra-valor]').forEach(input => {
            subtotal += parseFloat(input.value) || 0;
        });
    }

    // Taxi - zerar se taxi sem custo
    const taxiBuscar = document.getElementById('taxiBuscar').checked;
    const taxiLevar = document.getElementById('taxiLevar').checked;
    const valorTaxi = obterValorTaxi();

    if (!taxiSemCusto) {
        if (taxiBuscar) subtotal += valorTaxi;
        if (taxiLevar) subtotal += valorTaxi;
    }

    // Desconto
    const descontoValor = parseFloat(document.getElementById('descontoValor').value) || 0;
    const isPercentual = document.getElementById('descontoPercentual').checked;

    let valorDesconto = 0;
    if (isPercentual) {
        valorDesconto = (subtotal * descontoValor) / 100;
    } else {
        valorDesconto = descontoValor;
    }

    const total = Math.max(0, subtotal - valorDesconto);

    // Atualizar UI
    document.getElementById('valorSubtotal').textContent = formatarMoeda(subtotal);
    document.getElementById('valorDesconto').textContent = formatarMoeda(valorDesconto);
    document.getElementById('valorTotal').textContent = formatarMoeda(total);

    return { subtotal, valorDesconto, total };
}

// ========== REPETIDOR SEMANAL ==========
function toggleRepeater() {
    const enabled = document.getElementById('repeaterEnabled').checked;
    const options = document.getElementById('repeaterOptions');
    options.style.display = enabled ? 'block' : 'none';

    if (enabled) {
        updateRepeaterDates();
        // Atualizar quando mudar semanas ou data
        document.getElementById('repeaterWeeks').onchange = updateRepeaterDates;
        document.getElementById('agendData').onchange = updateRepeaterDates;
    }
}

function updateRepeaterDates() {
    const dataBase = document.getElementById('agendData').value;
    const semanas = parseInt(document.getElementById('repeaterWeeks').value);
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    if (!dataBase) {
        document.getElementById('repeaterDates').innerHTML = '<span style="color: var(--text-secondary);">Selecione uma data primeiro</span>';
        return;
    }

    // Verificar se é assinatura (tem limite de créditos)
    const assinaturaId = document.getElementById('petNome').dataset.assinaturaId;
    const creditosRestantes = parseInt(document.getElementById('petNome').dataset.creditosRestantes || '999');

    // Limitar semanas pelos créditos restantes se for assinatura
    let semanasEfetivas = semanas;
    if (assinaturaId && creditosRestantes < semanas) {
        semanasEfetivas = creditosRestantes;
        document.getElementById('repeaterInfo').innerHTML = `<em>(limitado a ${creditosRestantes} créditos)</em>`;
    } else {
        document.getElementById('repeaterInfo').innerHTML = '';
    }

    // Gerar lista de datas
    const datas = [];
    for (let i = 0; i < semanasEfetivas; i++) {
        const data = new Date(dataBase + 'T12:00:00');
        data.setDate(data.getDate() + (i * 7));
        const diaSemana = diasSemana[data.getDay()];
        const dataFormatada = data.toLocaleDateString('pt-BR');
        datas.push(`<strong>${diaSemana}</strong> ${dataFormatada}`);
    }

    document.getElementById('repeaterDates').innerHTML = datas.join(' • ');
}

async function salvarAgendamento(e) {
    e.preventDefault();

    const servicosSelecionados = obterServicosSelecionados();

    // Verificar se é modo assinatura (pula validação de serviços)
    const isAssinaturaMode = document.getElementById('formAgendamento')?.getAttribute('data-assinatura-mode') === 'true'
        || document.getElementById('petNome')?.dataset?.assinaturaId;

    if (servicosSelecionados.length === 0 && !isAssinaturaMode) {
        mostrarNotificacao('Selecione pelo menos um serviço!', 'error');
        return;
    }

    // Coletar valores customizados
    const valoresCustomizados = {};
    document.querySelectorAll('[data-servico-id]').forEach(input => {
        const id = input.dataset.servicoId;
        valoresCustomizados[id] = parseFloat(input.value);
    });

    // Coletar serviços extras
    const servicosExtras = obterServicosExtras();

    // Calcular valores
    const valores = calcularValorTotal();

    const agendamento = {
        pet_nome: document.getElementById('petNome').value,
        pet_id: document.getElementById('petId').value || null,
        data: document.getElementById('agendData').value,
        hora_inicio: document.getElementById('agendHora').value + ':00',
        duracao_minutos: calcularDuracao(servicosSelecionados),
        servicos: servicosSelecionados,
        servicos_extras: servicosExtras,
        valores_customizados: valoresCustomizados,
        desconto_tipo: document.getElementById('descontoPercentual').checked ? 'percentual' : 'valor',
        desconto_valor: parseFloat(document.getElementById('descontoValor').value) || 0,
        valor_total: valores.total,
        pago: false,
        taxi_buscar: document.getElementById('taxiBuscar').checked,
        taxi_levar: document.getElementById('taxiLevar').checked,
        observacoes: document.getElementById('observacoes').value,
        unidade_id: obterUnidadeAtual()
    };

    // Verificar se é agendamento de assinatura
    const assinaturaId = document.getElementById('petNome').dataset.assinaturaId;
    if (assinaturaId) {
        agendamento.assinatura_id = parseInt(assinaturaId);
        agendamento.sem_custo = true;
        agendamento.valor_total = 0; // Sem custo para assinatura

        // Adicionar extras de pacote (cobrados à parte)
        const extrasDescricao = document.getElementById('extrasDescricao')?.value?.trim() || '';
        const extrasValor = parseFloat(document.getElementById('extrasValor')?.value) || 0;
        if (extrasDescricao && extrasValor > 0) {
            agendamento.extras_descricao = extrasDescricao;
            agendamento.extras_valor = extrasValor;
            agendamento.extras_pago = false;
        }
    }

    console.log('Criando agendamento para unidade:', agendamento.unidade_id);

    // Verificar conflitos
    const resultado = verificarConflito(state.agendamentos, {
        ...agendamento,
        id: state.editandoAgendamento?.id
    });

    if (resultado.conflito) {
        const horaConflito = resultado.agendamento.hora_inicio ? resultado.agendamento.hora_inicio.substring(0, 5) : 'N/A';
        const confirmar = confirm(`Conflito detectado com agendamento de ${resultado.agendamento.pet_nome} às ${horaConflito}. Deseja continuar mesmo assim?`);
        if (!confirmar) return;
    }

    mostrarLoading(true);

    try {
        if (state.editandoAgendamento) {
            // Atualizar
            await fetchComAuth(`${API_URL}/agendamentos/${state.editandoAgendamento.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(agendamento)
            });
            mostrarNotificacao('Agendamento atualizado!', 'success');
        } else {
            // Criar - verificar se repetidor está ativo
            const repeaterEnabled = document.getElementById('repeaterEnabled').checked && !state.editandoAgendamento;
            const semanas = repeaterEnabled ? parseInt(document.getElementById('repeaterWeeks').value) : 1;
            const creditosRestantes = parseInt(document.getElementById('petNome').dataset.creditosRestantes || '999');

            // Limitar semanas pelos créditos para assinaturas
            const semanasEfetivas = assinaturaId ? Math.min(semanas, creditosRestantes) : semanas;

            // Se múltiplos pets, manter todos no mesmo card (pet_id fica null)
            const petIds = agendamento.pet_id ? agendamento.pet_id.split(',').map(id => id.trim()).filter(id => id) : [];
            if (petIds.length > 1) {
                agendamento.pet_id = null; // Múltiplos pets - não vincular a um ID específico
            } else if (petIds.length === 1) {
                agendamento.pet_id = parseInt(petIds[0]);
            }

            let agendamentosCriados = 0;
            const dataBase = new Date(agendamento.data + 'T12:00:00');

            // Loop por cada semana (todos os pets no mesmo card)
            for (let i = 0; i < semanasEfetivas; i++) {
                const dataAtual = new Date(dataBase);
                dataAtual.setDate(dataAtual.getDate() + (i * 7));
                const dataFormatada = dataAtual.toISOString().split('T')[0];

                const agendamentoAtual = { ...agendamento, data: dataFormatada };

                await fetchComAuth(`${API_URL}/agendamentos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agendamentoAtual)
                });

                // Consumir crédito da assinatura para cada agendamento
                if (assinaturaId) {
                    try {
                        await fetchComAuth(`${API_URL}/assinaturas/${assinaturaId}/usar-credito`, {
                            method: 'PATCH'
                        });
                    } catch (e) {
                        console.error('Erro ao consumir crédito:', e);
                    }
                }

                agendamentosCriados++;
            }

            if (agendamentosCriados > 1) {
                mostrarNotificacao(`${agendamentosCriados} agendamentos criados!`, 'success');
            } else {
                mostrarNotificacao('Agendamento criado!', 'success');
            }
        }

        fecharModalAgendamento();
        await carregarAgendamentos();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        mostrarNotificacao('Erro ao salvar agendamento!', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// ========== TOGGLE PAGAMENTO ==========
async function togglePagamento(id, pagoAtual, formaAtual) {
    if (pagoAtual) {
        // Marcar como não pago
        if (!confirm('Tem certeza que deseja marcar como NÃO PAGO?\n\nEste agendamento será contabilizado como "À Receber".')) {
            return;
        }

        await atualizarPagamento(id, false, null);
    } else {
        // Mostrar seleção de forma de pagamento
        mostrarSelecaoFormaPagamento(id);
    }
}

// ========== PAGAMENTO DE EXTRAS ==========
function pagarExtras(agendamentoId, descricao, valor) {
    const html = `
        <div class="extras-pagamento-popup" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.7); z-index: 9999; 
            display: flex; align-items: center; justify-content: center;">
            <div style="background: var(--bg-card); padding: 2rem; border-radius: 12px; 
                        max-width: 350px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <h3 style="margin-bottom: 0.5rem; color: #F59E0B;">➕ Pagar Serviço Extra</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">${descricao}</p>
                <p style="font-size: 1.5rem; font-weight: 700; color: #F59E0B; margin-bottom: 1.5rem;">${formatarMoeda(valor)}</p>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="confirmarPagamentoExtras(${agendamentoId}, 'dinheiro')" style="flex: 1; min-width: 80px;">💵 Dinheiro</button>
                    <button class="btn-secondary" onclick="confirmarPagamentoExtras(${agendamentoId}, 'pix')" style="flex: 1; min-width: 80px;">📱 PIX</button>
                    <button class="btn-secondary" onclick="confirmarPagamentoExtras(${agendamentoId}, 'cartao')" style="flex: 1; min-width: 80px;">💳 Cartão</button>
                </div>
                <button onclick="fecharExtrasPopup()" style="width: 100%; margin-top: 1rem; padding: 0.75rem; 
                        background: transparent; border: 1px solid var(--border-color); border-radius: 8px; 
                        color: var(--text-secondary); cursor: pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function confirmarPagamentoExtras(agendamentoId, formaPagamento) {
    fecharExtrasPopup();
    mostrarLoading(true);

    try {
        const response = await fetchComAuth(`${API_URL}/agendamentos/${agendamentoId}/pagar-extras`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forma_pagamento: formaPagamento })
        });

        if (response.ok) {
            mostrarNotificacao('Extra pago com sucesso! ✅', 'success');
            await carregarAgendamentos();
        } else {
            const erro = await response.json();
            mostrarNotificacao(`Erro: ${erro.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao pagar extras:', error);
        mostrarNotificacao('Erro ao processar pagamento', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function fecharExtrasPopup() {
    const popup = document.querySelector('.extras-pagamento-popup');
    if (popup) popup.remove();
    const addPopup = document.querySelector('.adicionar-extra-popup');
    if (addPopup) addPopup.remove();
}

// ========== ADICIONAR EXTRA EM AGENDAMENTO ==========
function abrirModalAdicionarExtra(agendamentoId) {
    const html = `
        <div class="adicionar-extra-popup" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.7); z-index: 9999; 
            display: flex; align-items: center; justify-content: center;">
            <div style="background: #1e1e2e; padding: 2rem; border-radius: 12px; 
                        max-width: 400px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <h3 style="margin-bottom: 1.5rem; color: #3B82F6;">➕ Adicionar Serviço Extra</h3>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Descrição do serviço</label>
                    <input type="text" id="extraDescricaoInput" class="form-input" placeholder="Ex: Corte de unhas" 
                           style="width: 100%; padding: 0.75rem;">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Valor (R$)</label>
                    <input type="number" id="extraValorInput" class="form-input" placeholder="0,00" 
                           min="0" step="0.01" style="width: 100%; padding: 0.75rem;">
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="fecharExtrasPopup()" 
                            style="flex: 1; padding: 0.75rem; background: transparent; border: 1px solid var(--border-color); 
                                   border-radius: 8px; color: var(--text-secondary); cursor: pointer;">
                        Cancelar
                    </button>
                    <button onclick="salvarExtraAgendamento(${agendamentoId})" 
                            style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); 
                                   border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: 600;">
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    // Focar no campo de descrição
    setTimeout(() => {
        document.getElementById('extraDescricaoInput')?.focus();
    }, 100);
}

async function salvarExtraAgendamento(agendamentoId) {
    const descricao = document.getElementById('extraDescricaoInput')?.value?.trim();
    const valor = parseFloat(document.getElementById('extraValorInput')?.value) || 0;

    if (!descricao) {
        mostrarNotificacao('Digite a descrição do serviço extra', 'error');
        return;
    }
    if (valor <= 0) {
        mostrarNotificacao('Digite um valor válido', 'error');
        return;
    }

    fecharExtrasPopup();
    mostrarLoading(true);

    try {
        const response = await fetchComAuth(`${API_URL}/agendamentos/${agendamentoId}/adicionar-extra`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                extras_descricao: descricao,
                extras_valor: valor
            })
        });

        if (response.ok) {
            mostrarNotificacao(`Extra "${descricao}" adicionado! Valor: ${formatarMoeda(valor)}`, 'success');
            await carregarAgendamentos();
        } else {
            const erro = await response.json();
            mostrarNotificacao(`Erro: ${erro.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar extra:', error);
        mostrarNotificacao('Erro ao salvar serviço extra', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function mostrarSelecaoFormaPagamento(agendamentoId) {
    const html = `
        <div class="forma-pagamento-popup">
            <h3>Selecione a Forma de Pagamento</h3>
            <button class="btn-forma dinheiro" onclick="selecionarFormaPagamento(${agendamentoId}, 'dinheiro')">
                💵 Dinheiro
            </button>
            <button class="btn-forma pix" onclick="selecionarFormaPagamento(${agendamentoId}, 'pix')">
                📱 Pix
            </button>
            <button class="btn-forma cartao" onclick="selecionarFormaPagamento(${agendamentoId}, 'cartao')">
                💳 Cartão
            </button>
            <button class="btn-forma cancelar" onclick="fecharSelecaoForma()">
                Cancelar
            </button>
        </div>
    `;

    const container = document.getElementById('formaPopupContainer');
    if (container) {
        container.innerHTML = html;
        container.style.display = 'flex';
    } else {
        console.error('Container formaPopupContainer não encontrado');
    }
}

async function selecionarFormaPagamento(id, forma) {
    fecharSelecaoForma();
    await atualizarPagamento(id, true, forma);
}

function fecharSelecaoForma() {
    const container = document.getElementById('formaPopupContainer');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

async function atualizarPagamento(id, pago, forma) {
    mostrarLoading(true);

    try {
        const response = await fetchComAuth(`${API_URL}/agendamentos/${id}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pago: pago,
                forma_pagamento: forma
            })
        });

        if (response.ok) {
            const data = await response.json();
            const mensagem = pago
                ? `Marcado como PAGO via ${forma.toUpperCase()}!`
                : 'Marcado como À RECEBER';
            mostrarNotificacao(mensagem, 'success', 2000);
            await carregarAgendamentos();
        } else {
            throw new Error('Erro ao atualizar');
        }
    } catch (error) {
        console.error('Erro ao atualizar pagamento:', error);
        mostrarNotificacao('Erro ao atualizar status de pagamento!', 'error');
    } finally {
        mostrarLoading(false);
    }
}

async function editarAgendamento(agendamento) {
    state.editandoAgendamento = agendamento;
    await carregarServicos();
    abrirModalAgendamento();
}

async function excluirAgendamento(id) {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

    mostrarLoading(true);

    try {
        // Primeiro buscar o agendamento para verificar se tem assinatura vinculada
        const agendamentoResponse = await fetchComAuth(`${API_URL}/agendamentos/${id}`);
        const agendamento = await agendamentoResponse.json();

        // Excluir o agendamento
        await fetchComAuth(`${API_URL}/agendamentos/${id}`, {
            method: 'DELETE'
        });

        // Se tinha assinatura vinculada, estornar o crédito
        if (agendamento.assinatura_id) {
            try {
                await fetchComAuth(`${API_URL}/assinaturas/${agendamento.assinatura_id}/estornar-credito`, {
                    method: 'PATCH'
                });
                mostrarNotificacao('Agendamento excluído! Crédito estornado.', 'success');
            } catch (e) {
                console.error('Erro ao estornar crédito:', e);
                mostrarNotificacao('Agendamento excluído! (Erro no estorno)', 'warning');
            }
        } else {
            mostrarNotificacao('Agendamento excluído!', 'success');
        }

        fecharModalAgendamento();
        await carregarAgendamentos();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        mostrarNotificacao('Erro ao excluir agendamento!', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// ========== MODAL CATÁLOGO ==========
async function abrirModalCatalogo() {
    await carregarServicosPorCategoria();
    renderizarCatalogo();
    document.getElementById('modalCatalogo').classList.add('active');
}

function fecharModalCatalogo() {
    document.getElementById('modalCatalogo').classList.remove('active');
    state.modoEdicaoCatalogo = false;
    document.getElementById('btnEditMode').textContent = '✏️ Modo Edição';
    document.getElementById('btnEditMode').classList.remove('btn-primary');
}

function renderizarCatalogo() {
    const container = document.getElementById('catalogoContent');

    container.innerHTML = state.servicosPorCategoria.map(categoria => `
        <div class="categoria-section">
            <div class="categoria-header">
                <div class="categoria-color" style="background-color: ${categoria.cor};"></div>
                <h3 class="categoria-title">${categoria.nome}</h3>
                ${state.modoEdicaoCatalogo ?
            `<button class="btn-add-servico" onclick="adicionarNovoServico(${categoria.id}, '${categoria.nome}')">+ Adicionar Serviço</button>`
            : ''}
            </div>
            ${categoria.servicos.length > 0 ? `
                <table class="servicos-table">
                    <thead>
                        <tr>
                            <th>Serviço</th>
                            <th>Preço</th>
                            <th>Duração</th>
                            ${state.modoEdicaoCatalogo ? '<th style="width: 80px;">Ações</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${categoria.servicos.map(serv => `
                            <tr>
                                <td>
                                    ${state.modoEdicaoCatalogo ?
                    `<input type="text" 
                                                class="preco-input" 
                                                value="${serv.nome}" 
                                                data-id="${serv.id}"
                                                onchange="atualizarServico(${serv.id}, 'nome', this.value)"
                                                style="width: 100%; color: var(--text-primary);">` :
                    `<span>${serv.nome}</span>`
                }
                                </td>
                                <td>
                                    ${state.modoEdicaoCatalogo ?
                    `<input type="number" 
                                                class="preco-input" 
                                                value="${serv.preco}" 
                                                step="0.01" 
                                                data-id="${serv.id}"
                                                onchange="atualizarServico(${serv.id}, 'preco', this.value)">` :
                    `<span class="preco-display">${formatarMoeda(serv.preco)}</span>`
                }
                                </td>
                                <td>
                                    ${state.modoEdicaoCatalogo ?
                    `<input type="number" 
                                                class="preco-input" 
                                                value="${serv.duracao_minutos}" 
                                                min="1"
                                                data-id="${serv.id}"
                                                onchange="atualizarServico(${serv.id}, 'duracao', this.value)"
                                                style="width: 100px;">` :
                    `<span>${serv.duracao_minutos} min</span>`
                }
                                </td>
                                ${state.modoEdicaoCatalogo ? `
                                    <td style="text-align: center;">
                                        <button class="btn-delete-small" onclick="excluirServico(${serv.id}, '${serv.nome.replace(/'/g, "\\'")}')">
                                            🗑️
                                        </button>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="color: var(--text-secondary); padding: 1rem;">Nenhum serviço nesta categoria ainda.</p>'}
        </div>
    `).join('');
}

// Cache para atualizações de serviço
let updateTimeout = null;

async function atualizarServico(servicoId, campo, valor) {
    clearTimeout(updateTimeout);

    updateTimeout = setTimeout(async () => {
        const servico = state.servicos.find(s => s.id === servicoId);
        if (!servico) return;

        const dados = {
            nome: servico.nome,
            preco: servico.preco,
            duracao_minutos: servico.duracao_minutos
        };

        if (campo === 'nome') dados.nome = valor;
        if (campo === 'preco') dados.preco = parseFloat(valor);
        if (campo === 'duracao') dados.duracao_minutos = parseInt(valor);

        try {
            await fetchComAuth(`${API_URL}/servicos/${servicoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });

            mostrarNotificacao('Serviço atualizado!', 'success', 2000);
            await carregarServicosPorCategoria();
        } catch (error) {
            console.error('Erro ao atualizar serviço:', error);
            mostrarNotificacao('Erro ao atualizar serviço!', 'error');
        }
    }, 500);
}



function filtrarCatalogo(termo) {
    const sections = document.querySelectorAll('.categoria-section');
    const termoLower = termo.toLowerCase();

    sections.forEach(section => {
        const texto = section.textContent.toLowerCase();
        section.style.display = texto.includes(termoLower) ? 'block' : 'none';
    });
}

// ========== MODAL FINANCEIRO ==========
function abrirModalFinanceiro() {
    const modal = document.getElementById('modalFinanceiro');
    if (!modal) {
        console.error('Modal financeiro não encontrado');
        return;
    }

    modal.classList.add('active');

    // Configurar data atual apenas
    const hoje = obterDataHoje();
    const agora = new Date();
    document.getElementById('financeiroData').value = hoje;

    const mesAtual = agora.getMonth() + 1;
    document.getElementById('financeiroMes').value = mesAtual;
    document.getElementById('financeiroAno').value = agora.getFullYear();

    console.log('🔍 [DEBUG] Modal aberto - Data:', hoje, 'Mês:', mesAtual, 'Ano:', agora.getFullYear());

    // Controle de visibilidade de tabs baseado no papel do usuário
    const tabBtnFinanceiro = document.getElementById('tabBtnFinanceiro');
    const tabBtnClientes = document.getElementById('tabBtnClientes');
    const userRole = state.currentUser?.role || 'operacao';

    if (tabBtnFinanceiro && tabBtnClientes) {
        // Admin vê ambas tabs, Financeiro como padrão
        if (userRole === 'admin') {
            tabBtnFinanceiro.style.display = 'inline-block';
            tabBtnClientes.style.display = 'inline-block';
            // Mostrar aba Financeiro por padrão
            if (typeof switchGestaoTab === 'function') switchGestaoTab('financeiro');
        }
        // Gerente vê ambas tabs, mas Clientes é a principal
        else if (userRole === 'gerente') {
            tabBtnFinanceiro.style.display = 'none'; // Gerente não vê Financeiro
            tabBtnClientes.style.display = 'inline-block';
            // Mostrar aba Clientes por padrão
            if (typeof switchGestaoTab === 'function') switchGestaoTab('clientes');
        }
        // Outros não têm acesso (botão já deveria estar oculto)
        else {
            tabBtnFinanceiro.style.display = 'none';
            tabBtnClientes.style.display = 'none';
        }
    }

    // Carregar dados iniciais (consolidado, diário) após abrir modal
    setTimeout(() => {
        if (typeof carregarRelatorioFinanceiroComUnidade === 'function') {
            console.log('📊 Carregando dados iniciais do financeiro...');
            carregarRelatorioFinanceiroComUnidade();
        }
    }, 100);
}

function fecharModalFinanceiro() {
    document.getElementById('modalFinanceiro').classList.remove('active');
}

function alternarTabFinanceiro(tab) {
    console.warn('alternarTabFinanceiro() chamada mas DESABILITADA - use financeiro-tabs.js');
}

async function carregarRelatorioFinanceiro() {
    const tabAtiva = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (!tabAtiva) return;

    let url;
    if (tabAtiva === 'diario') {
        const data = document.getElementById('financeiroData').value;
        if (!data) return;
        url = `${API_URL}/financeiro/diario/${data}`;
    } else {
        const mes = document.getElementById('financeiroMes').value;
        const ano = document.getElementById('financeiroAno').value;
        if (!mes || !ano) return;
        url = `${API_URL}/financeiro/mensal/${ano}/${mes}`;
    }

    mostrarLoading(true);

    try {
        const response = await fetch(url);
        const agendamentos = await response.json();

        calcularEExibirRelatorio(agendamentos, tabAtiva);
    } catch (error) {
        console.error('Erro ao carregar relatório:', error);
        mostrarNotificacao('Erro ao carregar relatório financeiro!', 'error');
    } finally {
        mostrarLoading(false);
    }
}

function calcularEExibirRelatorio(agendamentos, tipo) {
    let faturamentoTotal = 0;
    let faturamentoPago = 0;
    let faturamentoDevedor = 0;
    let faturamentoTaxi = 0;
    let faturamentoServicos = 0;

    // Novos campos
    let faturamentoPacotes = 0;
    let faturamentoAvulso = 0;
    let faturamentoDinheiro = 0;
    let faturamentoPix = 0;
    let faturamentoCartao = 0;

    agendamentos.forEach(agend => {
        const valorTotal = agend.valor_total || 0;
        faturamentoTotal += valorTotal;

        // Separar pago e a receber
        if (agend.pago) {
            faturamentoPago += valorTotal;

            // Por método de pagamento (apenas pagos)
            const forma = (agend.forma_pagamento || '').toLowerCase();
            if (forma === 'dinheiro') faturamentoDinheiro += valorTotal;
            else if (forma === 'pix') faturamentoPix += valorTotal;
            else if (forma === 'cartao' || forma === 'cartao_credito' || forma === 'cartao_debito') faturamentoCartao += valorTotal;
        } else {
            faturamentoDevedor += valorTotal;
        }

        // Por origem (pacote vs avulso)
        if (agend.assinatura_id) {
            faturamentoPacotes += valorTotal;
        } else {
            faturamentoAvulso += valorTotal;
        }

        // Calcular taxi separadamente
        const valorTaxi = obterValorTaxi();
        if (agend.taxi_buscar) faturamentoTaxi += valorTaxi;
        if (agend.taxi_levar) faturamentoTaxi += valorTaxi;
    });

    faturamentoServicos = faturamentoTotal - faturamentoTaxi;

    // Atualizar resumo principal
    document.getElementById('faturamentoTotal').textContent = formatarMoeda(faturamentoTotal);
    document.getElementById('faturamentoPago').textContent = formatarMoeda(faturamentoPago);
    document.getElementById('faturamentoDevedor').textContent = formatarMoeda(faturamentoDevedor);
    document.getElementById('faturamentoTaxi').textContent = formatarMoeda(faturamentoTaxi);
    document.getElementById('faturamentoServicos').textContent = formatarMoeda(faturamentoServicos);
    document.getElementById('totalAgendamentos').textContent = agendamentos.length;

    // Novos campos - sempre atualizar (podem estar ocultos)
    const elPacotes = document.getElementById('faturamentoPacotes');
    const elAvulso = document.getElementById('faturamentoAvulso');
    const elDinheiro = document.getElementById('faturamentoDinheiro');
    const elPix = document.getElementById('faturamentoPix');
    const elCartao = document.getElementById('faturamentoCartao');

    if (elPacotes) elPacotes.textContent = formatarMoeda(faturamentoPacotes);
    if (elAvulso) elAvulso.textContent = formatarMoeda(faturamentoAvulso);
    if (elDinheiro) elDinheiro.textContent = formatarMoeda(faturamentoDinheiro);
    if (elPix) elPix.textContent = formatarMoeda(faturamentoPix);
    if (elCartao) elCartao.textContent = formatarMoeda(faturamentoCartao);

    // Mostrar/ocultar seção de Origem e Pagamento baseado no tipo de visualização
    const statsOrigemPagamento = document.getElementById('statsOrigemPagamento');
    if (statsOrigemPagamento) {
        // Mostrar apenas para mensal e anual
        statsOrigemPagamento.style.display = (tipo === 'mensal' || tipo === 'anual') ? 'grid' : 'none';
    }

    // Armazenar agendamentos para exportação
    const relatorioLista = document.getElementById('relatorioLista');
    if (relatorioLista) {
        relatorioLista.dataset.agendamentos = JSON.stringify(agendamentos);
    }

    // Renderizar lista detalhada
    renderizarRelatorioDetalhado(agendamentos);
}

function renderizarRelatorioDetalhado(agendamentos) {
    const container = document.getElementById('relatorioLista');

    if (agendamentos.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhum agendamento encontrado</p>';
        return;
    }

    container.innerHTML = agendamentos.map(agend => {
        const servicosTexto = agend.servicos.map(s => s.nome).join(', ');
        const taxiTexto = [];
        if (agend.taxi_buscar) taxiTexto.push('Buscar');
        if (agend.taxi_levar) taxiTexto.push('Levar');
        const taxiInfo = taxiTexto.length > 0 ? ` | 🚗 ${taxiTexto.join(' e ')}` : '';

        const statusPagamento = agend.pago
            ? '<span style="color: #22C55E; font-weight: 600;">✅ Pago</span>'
            : '<span style="color: #EAB308; font-weight: 600;">⏳ A Receber</span>';

        return `
            <div class="relatorio-item">
                <div class="relatorio-item-info">
                    <div class="relatorio-item-pet">${agend.pet_nome} - ${formatarData(agend.data)} | ${statusPagamento}</div>
                    <div class="relatorio-item-servicos">${servicosTexto}${taxiInfo}</div>
                </div>
                <div class="relatorio-item-valor">${formatarMoeda(agend.valor_total || 0)}</div>
            </div>
        `;
    }).join('');
}

// ========== ADICIONAR NOVO SERVIÇO ==========
async function adicionarNovoServico(categoriaId, categoriaNome) {
    const nome = prompt(`Novo serviço para "${categoriaNome}":\n\nDigite o nome do serviço:`);
    if (!nome || nome.trim() === '') {
        mostrarNotificacao('Nome do serviço é obrigatório!', 'error');
        return;
    }

    const preco = prompt('Digite o preço (apenas números):', '0');
    if (preco === null) return;

    const precoNumero = parseFloat(preco);
    if (isNaN(precoNumero) || precoNumero < 0) {
        mostrarNotificacao('Preço inválido!', 'error');
        return;
    }

    const duracao = prompt('Digite a duração em minutos:', '60');
    if (duracao === null) return;

    const duracaoNumero = parseInt(duracao);
    if (isNaN(duracaoNumero) || duracaoNumero < 1) {
        mostrarNotificacao('Duração inválida!', 'error');
        return;
    }

    mostrarLoading(true);

    try {
        const response = await fetch(`${API_URL}/servicos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categoria_id: categoriaId,
                nome: nome.trim(),
                preco: precoNumero,
                duracao_minutos: duracaoNumero,
                descricao: ''
            })
        });

        if (response.ok) {
            mostrarNotificacao('Serviço adicionado com sucesso!', 'success');
            await carregarServicosPorCategoria();
            await carregarServicos();
            renderizarCatalogo();
        } else {
            throw new Error('Erro ao adicionar serviço');
        }
    } catch (error) {
        console.error('Erro ao adicionar serviço:', error);
        mostrarNotificacao('Erro ao adicionar serviço!', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// ========== EXCLUIR SERVIÇO ==========
async function excluirServico(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir "${nome}"?\n\nEsta ação não pode ser desfeita!`)) {
        return;
    }

    mostrarLoading(true);

    try {
        const response = await fetchComAuth(`${API_URL}/servicos/${id}`, { method: 'DELETE' });

        if (response.ok) {
            mostrarNotificacao('Serviço excluído com sucesso!', 'success');
            await carregarServicosPorCategoria();
            await carregarServicos();
            renderizarCatalogo();
        } else {
            throw new Error('Erro ao excluir');
        }
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        mostrarNotificacao('Erro ao excluir serviço!', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// ========== LOADING ==========
function mostrarLoading(mostrar) {
    const overlay = document.getElementById('loadingOverlay');
    if (mostrar) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// ========== AUTOCOMPLETE DE PETS ==========
let autocompleteTimeout;
let currentPetData = null;

function inicializarAutocompletePets() {
    const petNomeInput = document.getElementById('petNome');
    if (!petNomeInput) return;

    // Autocomplete ao digitar
    petNomeInput.addEventListener('input', async (e) => {
        clearTimeout(autocompleteTimeout);
        const query = e.target.value;

        // Limpar dados ao mudar
        document.getElementById('petId').value = '';
        document.getElementById('petInfo').innerHTML = '';
        currentPetData = null;

        if (query.length < 2) {
            document.getElementById('pets-autocomplete').innerHTML = '';
            return;
        }

        autocompleteTimeout = setTimeout(async () => {
            try {
                const response = await fetchComAuth(`${API_URL}/pets/autocomplete?q=${encodeURIComponent(query)}`);
                const pets = await response.json();

                document.getElementById('pets-autocomplete').innerHTML = pets.map(pet =>
                    `<option value="${pet.nome}" data-id="${pet.id}">${pet.nome} (${pet.tutor_nome})</option>`
                ).join('');
            } catch (error) {
                console.error('Erro autocomplete:', error);
            }
        }, 300);
    });

    // Quando selecionar do datalist
    petNomeInput.addEventListener('change', async (e) => {
        const petNome = e.target.value;

        try {
            const response = await fetchComAuth(`${API_URL}/pets/autocomplete?q=${encodeURIComponent(petNome)}`);
            const pets = await response.json();
            const petSelecionado = pets.find(p => p.nome === petNome);

            if (petSelecionado) {
                document.getElementById('petId').value = petSelecionado.id;
                currentPetData = petSelecionado;

                const infoHtml = `
                    <div class="tutor-info-preview">
                        <strong>Tutor:</strong> ${petSelecionado.tutor_nome}<br>
                        <strong>Telefone:</strong> ${petSelecionado.telefone}<br>
                        ${petSelecionado.endereco ? '<strong>Endereço:</strong> ' + petSelecionado.endereco : ''}
                    </div>
                `;
                document.getElementById('petInfo').innerHTML = infoHtml;
                mostrarNotificacao(`Cliente: ${petSelecionado.tutor_nome}`, 'info', 2000);
            }
        } catch (error) {
            console.error('Erro ao carregar pet:', error);
        }
    });
}

// ========== COPIAR ENDEREÇO ==========
function copiarEndereco(endereco, event, mostrarFeedback = true) {
    if (!endereco || endereco.trim() === '') {
        if (mostrarFeedback) {
            mostrarNotificacao('Endereço não disponível', 'error', 2000);
        }
        return;
    }

    // Copiar para clipboard
    try {
        navigator.clipboard.writeText(endereco);
        if (mostrarFeedback) {
            mostrarNotificacao('📋 Endereço copiado!', 'success', 2000);
        }
    } catch (error) {
        console.error('Erro ao copiar endereço:', error);
        if (mostrarFeedback) {
            mostrarNotificacao('Erro ao copiar endereço', 'error', 2000);
        }
    }
}

// ========== POPUP DE ENDEREÇO ==========
function mostrarEnderecoPopup(dadosTutor) {
    // Remover popup existente se houver
    const popupExistente = document.getElementById('enderecoPopup');
    if (popupExistente) {
        popupExistente.remove();
    }

    // Criar popup
    const popup = document.createElement('div');
    popup.id = 'enderecoPopup';
    popup.className = 'endereco-popup';

    popup.innerHTML = `
        <div class="endereco-popup-content">
            <div class="endereco-popup-header">
                <h4>📋 Informações de Contato</h4>
                <button class="btn-close-popup" onclick="fecharEnderecoPopup()">×</button>
            </div>
            <div class="endereco-popup-body">
                <div class="info-item">
                    <strong>👤 Tutor:</strong>
                    <span>${dadosTutor.nome}</span>
                </div>
                <div class="info-item">
                    <strong>📞 Telefone:</strong>
                    <span>${dadosTutor.telefone}</span>
                </div>
                <div class="info-item">
                    <strong>📍 Endereço:</strong>
                    <span>${dadosTutor.endereco}</span>
                </div>
            </div>
            <div class="endereco-popup-footer">
                <button class="btn-copiar-endereco" onclick="copiarEndereco('${dadosTutor.endereco.replace(/'/g, "\\'")}', event, true); fecharEnderecoPopup();">
                    📋 Copiar Endereço
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Fechar ao clicar fora
    setTimeout(() => {
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                fecharEnderecoPopup();
            }
        });
    }, 100);
}

function fecharEnderecoPopup() {
    const popup = document.getElementById('enderecoPopup');
    if (popup) {
        popup.remove();
    }
}

// ========== MOBILE TABS (SÓ FUNCIONA EM MOBILE) ==========
function initMobileTabs() {
    const tabs = document.querySelectorAll('.mobile-tab');
    const timeline = document.querySelector('.timeline-section');
    const sidebar = document.querySelector('.sidebar');

    if (!tabs.length || !timeline || !sidebar) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Atualizar abas ativas
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Mostrar/esconder seções
            if (tabName === 'timeline') {
                timeline.classList.add('mobile-active');
                sidebar.classList.remove('mobile-active');
            } else {
                timeline.classList.remove('mobile-active');
                sidebar.classList.add('mobile-active');
            }
        });
    });

    // Iniciar com timeline visível em mobile
    if (window.innerWidth <= 768) {
        timeline.classList.add('mobile-active');
    }
}

// Chamar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    initMobileTabs();
});

