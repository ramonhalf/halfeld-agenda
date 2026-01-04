// pacotes.js

// Estado local dos pacotes
let pacotesState = {
    lista: [],
    clienteAtualId: null
};

async function inicializarPacotes() {
    await carregarListaPacotes();

    // Configurar autocomplete de clientes para venda de pacotes
    const inputBuscaVenda = document.getElementById('buscaClientePacoteVenda');
    if (inputBuscaVenda) {
        await carregarClientesParaAutocomplete();

        // Listener para seleção de cliente
        inputBuscaVenda.addEventListener('input', handleClienteSearch);
        inputBuscaVenda.addEventListener('blur', handleClienteSelect);
    }

    // Configurar busca no novo modal de seleção de cliente para venda
    const inputBuscaModal = document.getElementById('inputBuscaClienteVenda');
    if (inputBuscaModal) {
        inputBuscaModal.addEventListener('input', (e) => filtrarClientesVenda(e.target.value));
    }

    // Auto-search se já tiver pet selecionado no form avulso ao trocar de aba
    const inputPet = document.getElementById('petNome');
    if (inputPet) {
        inputPet.addEventListener('blur', () => {
            // Se mudou o pet, tenta buscar pacotes se estiver na aba pacotes
            const tabPacote = document.getElementById('tabPacoteContent');
            if (tabPacote && tabPacote.style.display !== 'none') {
                checkPetAndLoadPackages();
            }
        });
    }
}

// ========== AUTOCOMPLETE DE CLIENTES ==========

let clientesCache = [];

async function carregarClientesParaAutocomplete() {
    try {
        // Buscar todos os pets para montar lista de clientes
        const response = await fetchComAuth(`${API_URL}/pets`);
        const pets = await response.json();

        // Agrupar pets por tutor
        const tutoresMap = new Map();
        pets.forEach(pet => {
            if (!tutoresMap.has(pet.tutor_id)) {
                tutoresMap.set(pet.tutor_id, {
                    tutor_id: pet.tutor_id,
                    tutor_nome: pet.tutor_nome,
                    pets: []
                });
            }
            tutoresMap.get(pet.tutor_id).pets.push(pet);
        });

        clientesCache = Array.from(tutoresMap.values());

        // Popular datalist
        const datalist = document.createElement('datalist');
        datalist.id = 'clientes-autocomplete-list';

        clientesCache.forEach(cliente => {
            // Opção com nome do tutor
            const optionTutor = document.createElement('option');
            optionTutor.value = cliente.tutor_nome;
            optionTutor.setAttribute('data-tutor-id', cliente.tutor_id);
            optionTutor.textContent = `${cliente.tutor_nome} (${cliente.pets.length} pet${cliente.pets.length > 1 ? 's' : ''})`;
            datalist.appendChild(optionTutor);

            // Opções com nomes dos pets
            cliente.pets.forEach(pet => {
                const optionPet = document.createElement('option');
                optionPet.value = `${pet.nome} - ${cliente.tutor_nome}`;
                optionPet.setAttribute('data-tutor-id', cliente.tutor_id);
                optionPet.setAttribute('data-pet-nome', pet.nome);
                datalist.appendChild(optionPet);
            });
        });

        // Substituir datalist antigo
        const oldDatalist = document.getElementById('clientes-autocomplete-list');
        if (oldDatalist) oldDatalist.remove();

        const input = document.getElementById('buscaClientePacoteVenda');
        if (input && input.parentNode) {
            input.parentNode.appendChild(datalist);
            input.setAttribute('list', 'clientes-autocomplete-list');
        }

        return clientesCache;
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        mostrarNotificacao('Erro ao carregar lista de clientes', 'error');
        return [];
    }
}

function handleClienteSearch(e) {
    // Não precisa fazer nada aqui pois o datalist funciona nativamente
}

function handleClienteSelect(e) {
    const valorDigitado = e.target.value.trim();
    if (!valorDigitado) return;

    // Procurar cliente pelo nome do tutor ou pet
    let clienteEncontrado = null;

    // Primeiro tenta encontrar por nome exato do tutor
    clienteEncontrado = clientesCache.find(c => c.tutor_nome === valorDigitado);

    // Se não encontrou, tenta por nome de pet
    if (!clienteEncontrado) {
        for (const cliente of clientesCache) {
            const petMatch = cliente.pets.find(p =>
                valorDigitado.includes(p.nome) ||
                valorDigitado === `${p.nome} - ${cliente.tutor_nome}`
            );
            if (petMatch) {
                clienteEncontrado = cliente;
                break;
            }
        }
    }

    if (clienteEncontrado) {
        document.getElementById('tutorIdSelecionado').value = clienteEncontrado.tutor_id;
        document.getElementById('clienteSelecionadoInfo').style.display = 'block';
        document.getElementById('clienteSelecionadoNome').textContent = clienteEncontrado.tutor_nome;

        // Carregar pacotes do cliente automaticamente
        carregarPacotesDoCliente(clienteEncontrado.tutor_id);

        // Limpar campo de busca após selecionar
        setTimeout(() => {
            e.target.value = '';
        }, 100);
    } else {
        // Limpar seleção se não encontrou
        document.getElementById('tutorIdSelecionado').value = '';
        document.getElementById('clienteSelecionadoInfo').style.display = 'none';
    }
}

function switchAgendamentoTab(tab) {
    // Buttons - resetar para estado inativo
    const btnAvulso = document.getElementById('tabBtnAvulso');
    const btnPacote = document.getElementById('tabBtnPacote');

    btnAvulso.classList.remove('active');
    btnPacote.classList.remove('active');

    // Resetar estilos para estado inativo
    btnAvulso.style.background = 'none';
    btnAvulso.style.borderBottom = 'none';
    btnAvulso.style.color = 'var(--text-secondary)';
    btnAvulso.style.fontWeight = '400';

    btnPacote.style.background = 'none';
    btnPacote.style.borderBottom = 'none';
    btnPacote.style.color = 'var(--text-secondary)';
    btnPacote.style.fontWeight = '400';

    // Content
    document.getElementById('formAgendamento').style.display = 'none';
    document.getElementById('tabPacoteContent').style.display = 'none';

    if (tab === 'avulso') {
        btnAvulso.classList.add('active');
        btnAvulso.style.background = 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(91, 33, 182, 0.2) 100%)';
        btnAvulso.style.borderBottom = '3px solid #A78BFA';
        btnAvulso.style.color = '#A78BFA';
        btnAvulso.style.fontWeight = '600';
        document.getElementById('formAgendamento').style.display = 'block';
    } else {
        btnPacote.classList.add('active');
        btnPacote.style.background = 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(91, 33, 182, 0.2) 100%)';
        btnPacote.style.borderBottom = '3px solid #A78BFA';
        btnPacote.style.color = '#A78BFA';
        btnPacote.style.fontWeight = '600';
        document.getElementById('tabPacoteContent').style.display = 'block';

        // Carregar pacotes disponíveis para venda
        // Carregar pacotes disponíveis para venda
        renderizarPacotesVenda();
        checkPetAndLoadPackages();

        // Carregar lista geral de assinaturas ativas
        carregarTodasAssinaturasAtivas();
    }
}

// ========== NOVA GESTÃO DE ASSINATURAS (MODAL) ==========

let todasAssinaturasCache = []; // Cache para filtro local no modal

function abrirModalControleAssinaturas() {
    const modal = document.getElementById('modalControleAssinaturas');
    if (!modal) return;
    modal.classList.add('active');
    carregarTodasAssinaturasAtivas();
}

function fecharModalGestaoAssinaturas() {
    document.getElementById('modalControleAssinaturas').classList.remove('active');
}

function destacarPacoteNaLista(clientePacoteId) {
    // Encontrar o card do pacote na lista
    const container = document.getElementById('listaTodasAssinaturasModal');
    if (!container) return;

    // Procurar pelo card com o data-id correspondente
    const cards = container.querySelectorAll('[data-cliente-pacote-id]');
    let pacoteCard = null;

    cards.forEach(card => {
        if (parseInt(card.dataset.clientePacoteId) === clientePacoteId) {
            pacoteCard = card;
        }
    });

    if (pacoteCard) {
        // Scroll suave até o card
        pacoteCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Aplicar destaque temporário
        pacoteCard.style.boxShadow = '0 0 0 3px var(--primary-gold), 0 0 20px rgba(255, 215, 0, 0.3)';
        pacoteCard.style.transform = 'scale(1.02)';

        // Remover destaque após 2 segundos
        setTimeout(() => {
            pacoteCard.style.boxShadow = '';
            pacoteCard.style.transform = '';
        }, 2000);
    }
}

async function carregarTodasAssinaturasAtivas() {
    const container = document.getElementById('listaTodasAssinaturasModal');
    if (!container) return;

    container.innerHTML = '<p class="text-center text-secondary">Carregando assinaturas...</p>';

    try {
        const response = await fetchComAuth(`${API_URL}/assinaturas`);
        todasAssinaturasCache = await response.json();

        renderizarListaAssinaturas(todasAssinaturasCache);

    } catch (e) {
        console.error('Erro ao carregar assinaturas:', e);
        container.innerHTML = '<p class="text-danger text-center">Erro ao carregar assinaturas.</p>';
    }
}

function filtrarAssinaturasAtivas() {
    // Verifica ambos os campos de filtro (modal original e tab de assinatura)
    const termo = (document.getElementById('buscaAssinaturas')?.value ||
        document.getElementById('filtroAssinaturaTutor')?.value || '').toLowerCase();

    const filtrados = todasAssinaturasCache.filter(a =>
        (a.cliente_nome || '').toLowerCase().includes(termo) ||
        (a.nome_plano || '').toLowerCase().includes(termo)
    );

    renderizarListaAssinaturas(filtrados);
}

function renderizarListaAssinaturas(lista) {
    const container = document.getElementById('listaTodasAssinaturasModal');

    if (!lista || lista.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center">Nenhuma assinatura ativa.</p>';
        return;
    }

    container.innerHTML = lista.map(a => {
        const creditosRestantes = a.creditos_total - a.creditos_usados;
        const esgotado = creditosRestantes === 0;

        // Escape aspas simples para uso em onclick handlers
        const clienteNomeSafe = (a.cliente_nome || '').replace(/'/g, "\\'");
        const nomePlanoSafe = (a.nome_plano || '').replace(/'/g, "\\'");

        // Status text like legacy: "Pacote Esgotado (0/2)" or "Restam: X de Y serviços"
        const statusText = esgotado
            ? `<span style="color: #F59E0B; font-weight: 600;">Pacote Esgotado (${a.creditos_usados}/${a.creditos_total})</span>`
            : `Restam: <strong style="color: #F59E0B;">${creditosRestantes}</strong> de ${a.creditos_total} serviços`;

        // Payment status
        const pagamentoStatus = !a.pago
            ? '<span style="color: #F59E0B; font-weight: 600;">⚠️ A Pagar</span>'
            : '<span style="color: #10B981; font-weight: 600;">✅ Pago</span>';

        return `
        <div class="card-pacote-cliente" 
             data-assinatura-id="${a.id}"
             style="border-left: 4px solid ${a.pago ? '#10B981' : '#F59E0B'}; background: var(--bg-card); border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem;">
            
            <!-- Header: Nome Pet + Badge Cliente -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <strong style="font-size: 1.1rem; color: var(--text-primary);">${a.nome_plano}</strong>
                <span style="background: rgba(124, 58, 237, 0.25); color: #A78BFA; padding: 0.25rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 500;">
                    👤 ${a.cliente_nome}
                </span>
            </div>
            
            <!-- Status: Restam X de Y / Esgotado + A Pagar -->
            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
                ${statusText} • ${pagamentoStatus}
            </div>
            
            <!-- Buttons: Pagar | Agendar/Renovar | Datas | Excluir -->
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <!-- Pagar / Cancelar Pgto -->
                ${!a.pago ? `
                    <button class="btn-gold" style="flex: 1; height: 40px; font-size: 0.9rem; min-width: 100px; border-radius: 8px;" 
                            onclick="pagarAssinaturaModal(${a.id}, '${nomePlanoSafe}', ${a.valor_total})">
                        💰 Pagar
                    </button>
                ` : `
                    <button style="flex: 1; height: 40px; font-size: 0.9rem; min-width: 100px; border-radius: 8px; background: transparent; border: 1px solid #6B7280; color: #9CA3AF; cursor: pointer;" 
                            onclick="cancelarPagamentoAssinaturaModal(${a.id}, '${nomePlanoSafe}')">
                        ↩️ Cancelar Pgto
                    </button>
                `}
                
                <!-- Agendar ou Renovar -->
                ${esgotado ? `
                    <button class="btn-primary" style="flex: 1; height: 40px; font-size: 0.9rem; min-width: 100px; border-radius: 8px; background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);" 
                            onclick="renovarAssinaturaModal(${a.id}, ${a.creditos_total}, ${a.valor_total})">
                        🔄 Renovar
                    </button>
                ` : `
                    <button class="btn-primary" style="flex: 1; height: 40px; font-size: 0.9rem; min-width: 100px; border-radius: 8px; background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);" 
                            onclick="agendarComAssinatura(${a.id}, ${a.cliente_id || 'null'}, '${clienteNomeSafe}', ${creditosRestantes || 1})">
                        📅 Agendar
                    </button>
                `}
                
                <!-- Datas -->
                <button style="flex: 1; height: 40px; font-size: 0.9rem; min-width: 80px; border-radius: 8px; background: transparent; border: 1px solid #6B7280; color: #9CA3AF; cursor: pointer;" 
                        onclick="abrirModalDatasAssinatura(${a.id}, '${nomePlanoSafe}', '${clienteNomeSafe}')">
                    📅 Datas
                </button>
                
                <!-- Excluir -->
                <button style="flex: 1; height: 40px; font-size: 0.9rem; min-width: 80px; border-radius: 8px; background: transparent; border: 1px solid #EF4444; color: #EF4444; cursor: pointer;" 
                        onclick="cancelarAssinaturaModal(${a.id}, '${nomePlanoSafe}')">
                    🗑️ Excluir
                </button>
            </div>
        </div>
    `}).join('');
}

// ========== HISTÓRICO DE AGENDAMENTOS ==========

function abrirModalHistoricoAgendamentos() {
    document.getElementById('modalHistoricoAgendamentos').classList.add('active');
}

function fecharModalHistoricoAgendamentos() {
    document.getElementById('modalHistoricoAgendamentos').classList.remove('active');
}

async function visualizarHistoricoUso(clientePacoteId, pacoteNome, tutorNome) {
    const listContainer = document.getElementById('listaHistoricoUso');
    const headerContainer = document.getElementById('cabecalhoHistorico');

    abrirModalHistoricoAgendamentos();

    headerContainer.innerHTML = `
        <h3 style="color: var(--primary-gold); margin-bottom: 0.25rem;">${pacoteNome}</h3>
        <div style="color: var(--text-secondary);">Cliente: <strong>${tutorNome}</strong></div>
    `;

    listContainer.innerHTML = '<p class="text-center">Carregando datas agendadas...</p>';

    try {
        const response = await fetchComAuth(`${API_URL}/pacotes/${clientePacoteId}/agendamentos`);

        // Verificar se a resposta é OK antes de tentar parsear
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erro ${response.status}: ${response.statusText}`, errorText);
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error('❌ Resposta não é JSON:', responseText.substring(0, 200));
            throw new Error('Servidor retornou resposta inválida (não é JSON)');
        }

        const agendamentos = await response.json();

        if (agendamentos.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-secondary" style="padding: 2rem;">Nenhuma data agendada com este pacote.</p>';
            return;
        }

        listContainer.innerHTML = agendamentos.map((ag, index) => {
            const dataObj = new Date(ag.data + 'T00:00:00');
            const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const diaSemana = diasSemana[dataObj.getDay()];

            return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                    <div style="color: var(--primary-purple); font-weight: 700; font-size: 2rem; min-width: 60px;">*${index + 1}</div>
                    <div style="font-weight: 600; font-size: 1.3rem; color: var(--text-primary);">${diaSemana}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; font-size: 1.2rem; color: var(--text-primary);">${formatarDataLocal(ag.data)}</div>
                    <div style="font-size: 1.1rem; color: var(--text-secondary); margin-top: 0.2rem;">${ag.horario.substring(0, 5)}</div>
                </div>
            </div>
        `;
        }).join('');

    } catch (e) {
        console.error('❌ Erro ao carregar histórico:', e);
        listContainer.innerHTML = `
            <p class="text-center text-danger" style="padding: 2rem;">
                Erro ao carregar datas agendadas.<br>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">${e.message}</span>
            </p>
        `;
    }
}

async function carregarListaPacotes() {
    try {
        const response = await fetchComAuth(`${API_URL}/pacotes`);
        pacotesState.lista = await response.json();
    } catch (error) {
        console.error('Erro ao carregar pacotes:', error);
    }
}

function renderizarPacotesVenda() {
    const container = document.getElementById('listaPacotesDisponiveis');
    if (!container) return;

    if (pacotesState.lista.length === 0) {
        container.innerHTML = '<p class="text-secondary">Nenhum pacote cadastrado.</p>';
        return;
    }

    container.innerHTML = pacotesState.lista.map(p => `
        <div class="card-pacote" style="border: 1px solid var(--border-color); padding: 1rem; border-radius: 8px; background: var(--bg-card);">
            <div style="font-weight: 600; font-size: 1.1rem;">${p.nome}</div>
            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${p.qtd_servicos} serviços • ${formatarMoeda(p.valor)}</div>
            ${p.descricao ? `<div style="font-size: 0.85rem; margin-bottom: 0.5rem;">${p.descricao}</div>` : ''}
            <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                <button class="btn-primary" style="flex: 1; font-size: 1.1rem; font-weight: 600; height: 48px;" onclick="iniciarVendaPacote(${p.id})">Vender</button>
                <button class="btn-outline-danger" style="min-width: 50px; height: 48px; font-size: 1.3rem; padding: 0;" onclick="deletarTipoPacote(${p.id}, '${p.nome}')" title="Excluir pacote">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function checkPetAndLoadPackages() {
    // Tenta pegar o ID do tutor através do input de pet ou busca global
    // Como o sistema atual usa Autocomplete no input 'petNome', precisamos pegar o petId escondido
    const petId = document.getElementById('petId').value;

    if (petId) {
        // Buscar info do pet para pegar tutor
        try {
            const res = await fetchComAuth(`${API_URL}/pets/${petId}`); // Assumindo rota existe, ou usar infos já carregadas
            // Se não tiver rota direta, podemos tentar achar nos agendamentos ou lista local
            // Mas vamos assumir que conseguimos o tutorId.
            // WORKAROUND: O autocomplete preenche o petId. Se tivermos acesso ao state.agendamentos ou lista de pets, podemos achar.
            // Vou usar uma busca simulada se a rota não existir

            // Mas, o usuário pode buscar diretamente na aba pacotes também
            const petNome = document.getElementById('petNome').value;
            console.log('Buscando pacotes para pet:', petNome);

            // Melhor: Buscar tutor via autocomplete se implementado.
            // Se não, pede pro usuário selecionar.
            document.getElementById('buscaClientePacote').value = petNome;
            // TODO: Implementar busca real

        } catch (e) {
            console.error(e);
        }
    }
}


// ========== GESTÃO DE PACOTES (ADMIN) ==========

function abrirModalGerenciarPacotes() {
    document.getElementById('modalGerenciarPacotes').classList.add('active');
    carregarListaPacotesGestao();
}

function fecharModalGerenciarPacotes() {
    document.getElementById('modalGerenciarPacotes').classList.remove('active');
}

function carregarListaPacotesGestao() {
    const container = document.getElementById('listaGestaoPacotes');
    if (!container) return;

    if (pacotesState.lista.length === 0) {
        container.innerHTML = '<p>Nenhum pacote.</p>';
        return;
    }

    container.innerHTML = pacotesState.lista.map(p => `
        <div class="pacote-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid var(--border-color);">
            <div>
                <strong>${p.nome}</strong> (${p.qtd_servicos} serviços) - ${formatarMoeda(p.valor)}
            </div>
            <button class="btn-delete" onclick="excluirPacote(${p.id})" title="Excluir">🗑️</button>
        </div>
    `).join('');
}

async function criarPacote(e) {
    e.preventDefault();
    const nome = document.getElementById('novoPacoteNome').value;
    const qtd = parseInt(document.getElementById('novoPacoteQtd').value);
    const valor = parseFloat(document.getElementById('novoPacoteValor').value);
    const descricao = document.getElementById('novoPacoteDescricao').value;

    try {
        await fetchComAuth(`${API_URL}/pacotes`, {
            method: 'POST',
            body: JSON.stringify({ nome, qtd_servicos: qtd, valor, descricao })
        });

        document.getElementById('formNovoPacote').reset();
        await carregarListaPacotes();
        carregarListaPacotesGestao();
        renderizarPacotesVenda(); // Atualiza a outra lista também

        fecharModalGerenciarPacotes();
        mostrarNotificacao('Pacote criado com sucesso!', 'success');
    } catch (error) {
        console.error(error);
        mostrarNotificacao('Erro ao criar pacote', 'error');
    }
}

async function excluirPacote(id) {
    if (!confirm('Tem certeza que deseja excluir este pacote?')) return;
    try {
        await fetchComAuth(`${API_URL}/pacotes/${id}`, { method: 'DELETE' });
        await carregarListaPacotes();
        carregarListaPacotesGestao();
        renderizarPacotesVenda();
    } catch (error) {
        mostrarNotificacao('Erro ao excluir', 'error');
    }
}

// ========== VENDAS ==========

async function iniciarVendaPacote(pacoteId) {
    const pacote = pacotesState.lista.find(p => p.id === pacoteId);
    if (!pacote) {
        mostrarNotificacao('Pacote não encontrado', 'error');
        return;
    }

    // Salvar ID do pacote temporariamente
    pacotesState.pacoteVendaPendenteId = pacoteId;

    // Abrir modal de seleção de cliente
    abrirModalSelecaoClienteVenda();
}


// ========== MODAL SELEÇÃO CLIENTE (NOVO FLUXO) ==========

async function abrirModalSelecaoClienteVenda() {
    document.getElementById('modalSelecaoClienteVenda').classList.add('active');
    document.getElementById('inputBuscaClienteVenda').value = '';

    // Garantir que clientes estão carregados
    if (clientesCache.length === 0) {
        await carregarClientesParaAutocomplete();
    }

    renderizarResultadosClienteVenda(clientesCache.slice(0, 10)); // Mostrar alguns iniciais
    document.getElementById('inputBuscaClienteVenda').focus();
}

function fecharModalSelecaoClienteVenda() {
    document.getElementById('modalSelecaoClienteVenda').classList.remove('active');
    pacotesState.pacoteVendaPendenteId = null;
}

function filtrarClientesVenda(termo) {
    termo = termo.toLowerCase();
    if (!termo) {
        renderizarResultadosClienteVenda(clientesCache.slice(0, 10));
        return;
    }

    const resultados = clientesCache.filter(c =>
        c.tutor_nome.toLowerCase().includes(termo) ||
        c.pets.some(p => p.nome.toLowerCase().includes(termo))
    );

    renderizarResultadosClienteVenda(resultados);
}

function renderizarResultadosClienteVenda(lista) {
    const container = document.getElementById('listaResultadosClienteVenda');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center">Nenhum cliente encontrado.</p>';
        return;
    }

    container.innerHTML = lista.map(c => `
        <div class="cliente-item-venda" onclick="selecionarClienteVenda(${c.tutor_id})" 
             style="padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.2s; background: var(--bg-card);">
            <div style="font-weight: 600; color: var(--text-primary);">${c.tutor_nome}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                Pets: ${c.pets.map(p => p.nome).join(', ')}
            </div>
        </div>
    `).join('');
}

function selecionarClienteVenda(tutorId) {
    const pacoteId = pacotesState.pacoteVendaPendenteId;
    if (!pacoteId) return;

    const pacote = pacotesState.lista.find(p => p.id === pacoteId);
    const cliente = clientesCache.find(c => c.tutor_id === tutorId);

    if (pacote && cliente) {
        // Fechar modal de seleção
        fecharModalSelecaoClienteVenda();

        // TEMPORÁRIO: Hack para preencher os dados ocultos que o modal de pagamento usa
        // (Já que o modal de escolha de pagamento usa o DOM para pegar o nome do cliente)
        // Idealmente refatoraríamos mostrarModalEscolhaVenda para aceitar objetos puros.
        // Mas para manter compatibilidade rápida:
        const dummyName = document.createElement('div');
        dummyName.id = 'clienteSelecionadoNome';
        dummyName.textContent = cliente.tutor_nome;
        dummyName.style.display = 'none';

        // Se já existir, atualiza/usa ele
        const existingName = document.getElementById('clienteSelecionadoNome');
        if (existingName) {
            existingName.textContent = cliente.tutor_nome;
        } else {
            document.body.appendChild(dummyName);
        }

        // Mostrar modal de pagamento
        mostrarModalEscolhaVenda(pacoteId, tutorId, pacote);
    }
}

async function venderPacoteAPrazo(pacoteId, tutorId, pacote) {
    try {
        const venda = {
            tutor_id: tutorId,
            pacote_id: pacoteId,
            pago: false,
            forma_pagamento: null
        };

        const response = await fetchComAuth(`${API_URL}/pacotes/venda`, {
            method: 'POST',
            body: JSON.stringify(venda)
        });

        const result = await response.json();
        mostrarNotificacao(`Pacote "${pacote.nome}" vendido a prazo!`, 'success');

        // Atualizar lista geral de assinaturas
        carregarTodasAssinaturasAtivas();

    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao vender pacote: ' + e.message, 'error');
    }
}

function abrirModalFormaPagamentoPacote(pacoteId, tutorId, pacote) {
    // Criar/mostrar popup com opções de forma de pagamento
    // Reutilizar o mesmo popup do sidebar

    const formaPopup = `
        <div id="formaPacotePopup" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 16px; max-width: 400px; border: 1px solid var(--border-color);">
                <h3 style="margin-bottom: 1.5rem; color: var(--primary-gold);">Escolha a Forma de Pagamento</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <button class="btn-forma dinheiro" onclick="confirmarVendaPacotePaga(${pacoteId}, ${tutorId}, 'dinheiro')" style="padding: 1rem; font-size: 1.1rem; border-radius: 12px; border: none; cursor: pointer; background: #10B981; color: white; font-weight: 600;">
                        💵 Dinheiro
                    </button>
                    <button class="btn-forma pix" onclick="confirmarVendaPacotePaga(${pacoteId}, ${tutorId}, 'pix')" style="padding: 1rem; font-size: 1.1rem; border-radius: 12px; border: none; cursor: pointer; background: #3B82F6; color: white; font-weight: 600;">
                        📱 Pix
                    </button>
                    <button class="btn-forma cartao" onclick="confirmarVendaPacotePaga(${pacoteId}, ${tutorId}, 'cartao')" style="padding: 1rem; font-size: 1.1rem; border-radius: 12px; border: none; cursor: pointer; background: #9333EA; color: white; font-weight: 600;">
                        💳 Cartão
                    </button>
                    <button class="btn-forma cancelar" onclick="fecharModalFormaPacote()" style="padding: 0.75rem; font-size: 0.95rem; border-radius: 12px; border: none; cursor: pointer; background: #6B7280; color: white; margin-top: 0.5rem;">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;

    // Remover popup antigo se existir
    const popupAntigo = document.getElementById('formaPacotePopup');
    if (popupAntigo) popupAntigo.remove();

    document.body.insertAdjacentHTML('beforeend', formaPopup);
}

function fecharModalFormaPacote() {
    const popup = document.getElementById('formaPacotePopup');
    if (popup) popup.remove();
}

async function confirmarVendaPacotePaga(pacoteId, tutorId, formaPagamento) {
    try {
        const venda = {
            tutor_id: tutorId,
            pacote_id: pacoteId,
            pago: true,
            forma_pagamento: formaPagamento
        };

        await fetchComAuth(`${API_URL}/pacotes/venda`, {
            method: 'POST',
            body: JSON.stringify(venda)
        });

        fecharModalFormaPacote();
        mostrarNotificacao(`Venda realizada e registrada no caixa!`, 'success');

        // Atualizar lista geral de assinaturas
        carregarTodasAssinaturasAtivas();

    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao realizar venda: ' + e.message, 'error');
    }
}

// ========== LISTAGEM CLIENTE REMOVIDA (USAR MODAL GERAL) ==========

// Função para pagar pacote contratado
async function pagarPacoteContratado(clientePacoteId, pacoteNome, valor) {
    // Abrir modal de forma de pagamento (mesmo estilo da venda)
    const formaPopup = `
        <div id="formaPagamentoPacotePopup" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 99999;">
            <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 16px; max-width: 400px; border: 1px solid var(--border-color);">
                <h3 style="margin-bottom: 0.5rem; color: var(--primary-gold);">Receber Pagamento</h3>
                <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">${pacoteNome} - ${formatarMoeda(valor)}</p>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <button class="btn-forma dinheiro" onclick="confirmarPagamentoPacote(${clientePacoteId}, 'dinheiro')" style="padding: 1rem; font-size: 1.1rem; border-radius: 12px; border: none; cursor: pointer; background: #10B981; color: white; font-weight: 600;">
                        💵 Dinheiro
                    </button>
                    <button class="btn-forma pix" onclick="confirmarPagamentoPacote(${clientePacoteId}, 'pix')" style="padding: 1rem; font-size: 1.1rem; border-radius: 12px; border: none; cursor: pointer; background: #3B82F6; color: white; font-weight: 600;">
                        📱 Pix
                    </button>
                    <button class="btn-forma cartao" onclick="confirmarPagamentoPacote(${clientePacoteId}, 'cartao')" style="padding: 1rem; font-size: 1.1rem; border-radius: 12px; border: none; cursor: pointer; background: #9333EA; color: white; font-weight: 600;">
                        💳 Cartão
                    </button>
                    <button class="btn-forma cancelar" onclick="fecharModalPagamentoPacote()" style="padding: 0.75rem; font-size: 0.95rem; border-radius: 12px; border: none; cursor: pointer; background: #6B7280; color: white; margin-top: 0.5rem;">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
        `;

    // Remover popup antigo se existir
    const popupAntigo = document.getElementById('formaPagamentoPacotePopup');
    if (popupAntigo) popupAntigo.remove();

    document.body.insertAdjacentHTML('beforeend', formaPopup);
}

function fecharModalPagamentoPacote() {
    const popup = document.getElementById('formaPagamentoPacotePopup');
    if (popup) popup.remove();
}

async function confirmarPagamentoPacote(clientePacoteId, formaPagamento) {
    try {
        console.log(`🔄 Tentando pagar pacote ${clientePacoteId} com ${formaPagamento}`);

        const response = await fetchComAuth(`${API_URL}/pacotes/cliente/${clientePacoteId}/pagar`, {
            method: 'PUT',
            body: JSON.stringify({ forma_pagamento: formaPagamento })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao processar pagamento');
        }

        fecharModalPagamentoPacote();
        mostrarNotificacao('Pagamento registrado com sucesso!', 'success');

        // Atualizar lista geral de assinaturas
        carregarTodasAssinaturasAtivas();

    } catch (e) {
        console.error('❌ Erro ao confirmar pagamento:', e);
        mostrarNotificacao('Erro ao registrar pagamento: ' + e.message, 'error');
    }
}

// Função para cancelar pacote contratado
async function cancelarPacoteContratado(clientePacoteId, pacoteNome) {
    if (!confirm(`Tem certeza que deseja CANCELAR a assinatura "${pacoteNome}"?\n\nEsta ação marcará o pacote como inativo e não poderá ser revertida.`)) {
        return;
    }

    try {
        await fetchComAuth(`${API_URL}/pacotes/cliente/${clientePacoteId}/cancelar`, {
            method: 'PUT'
        });

        mostrarNotificacao('Assinatura cancelada com sucesso!', 'success');

        // Atualizar lista geral de assinaturas
        carregarTodasAssinaturasAtivas();

    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao cancelar assinatura: ' + e.message, 'error');
    }
}

function usarPacote(clientePacoteId) {
    // 1. Obter informações do tutor selecionado e do pacote
    const tutorId = document.getElementById('tutorIdSelecionado').value;
    const tutorNome = document.getElementById('clienteSelecionadoNome').textContent;

    if (!tutorId) {
        mostrarNotificacao('Cliente não identificado. Por favor, selecione novamente o cliente.', 'warning');
        return;
    }

    // 2. Trocar para aba avulso
    switchAgendamentoTab('avulso');

    // 3. Buscar primeiro pet do tutor para preencher automaticamente
    const cliente = clientesCache.find(c => c.tutor_id == tutorId);
    if (cliente && cliente.pets && cliente.pets.length > 0) {
        const primeiroPet = cliente.pets[0];

        // Preencher campo de pet
        const inputPet = document.getElementById('petNome');
        const inputPetId = document.getElementById('petId');

        if (inputPet && inputPetId) {
            inputPet.value = primeiroPet.nome;
            inputPetId.value = primeiroPet.id;

            // Disparar evento para atualizar outros campos que dependem do pet
            inputPet.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // 4. Adicionar campo hidden com ID do pacote
    let hiddenInput = document.getElementById('usoPacoteId');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'usoPacoteId';
        document.getElementById('formAgendamento').appendChild(hiddenInput);
    }
    hiddenInput.value = clientePacoteId;

    // 5. Adicionar aviso visual no formulário
    let avisoDiv = document.getElementById('avisoPacoteAtivo');
    if (!avisoDiv) {
        avisoDiv = document.createElement('div');
        avisoDiv.id = 'avisoPacoteAtivo';
        avisoDiv.style.cssText = `
            background: linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(91, 33, 182, 0.15) 100%);
            border: 2px solid var(--light-purple);
            border-radius: 12px;
            padding: 1rem;
            margin: 0 0 1.5rem 0;
            text-align: center;
            animation: pulse 2s ease-in-out infinite;
            width: 100%;
            box-sizing: border-box;
            position: relative;
        `;

        // Inserir no início do formulário
        const formAgendamento = document.getElementById('formAgendamento');
        if (formAgendamento.firstChild) {
            formAgendamento.insertBefore(avisoDiv, formAgendamento.firstChild);
        } else {
            formAgendamento.appendChild(avisoDiv);
        }
    }

    avisoDiv.innerHTML = `
        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">
            📦 <strong style="color: var(--light-purple);">Usando Pacote/Assinatura</strong>
        </div>
        <div style="font-size: 0.9rem; color: var(--text-secondary);">
            Este agendamento consumirá 1 crédito do pacote de <strong>${tutorNome}</strong>
        </div>
        <button type="button" onclick="cancelarUsoPacote()" style="
            margin-top: 0.75rem;
            padding: 0.5rem 1rem;
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #EF4444;
            border-radius: 8px;
            color: #EF4444;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
        ">
            ✕ Cancelar Uso do Pacote
        </button>
    `;

    avisoDiv.style.display = 'block';

    // 6. Notificação
    mostrarNotificacao(`📦 Pacote selecionado! Cliente: ${tutorNome}`, 'success');
}

// Função para agendar usando um pacote específico (chamada pelo botão nas assinaturas)
function agendarComPacote(clientePacoteId, tutorId, tutorNome) {
    // Fechar modal de gestão de assinaturas
    fecharModalGestaoAssinaturas();

    // Abrir modal de agendamento
    const modal = document.getElementById('modalAgendamento');
    if (!modal) {
        mostrarNotificacao('Modal de agendamento não encontrado', 'error');
        return;
    }

    modal.classList.add('active');
    document.getElementById('modalTitle').textContent = 'Novo Agendamento com Pacote';

    // Mudar para aba avulso
    switchAgendamentoTab('avulso');

    // Preencher informações do tutor em campos ocultos
    let tutorIdInput = document.getElementById('tutorIdSelecionado');
    if (!tutorIdInput) {
        tutorIdInput = document.createElement('input');
        tutorIdInput.type = 'hidden';
        tutorIdInput.id = 'tutorIdSelecionado';
        document.getElementById('formAgendamento').appendChild(tutorIdInput);
    }
    tutorIdInput.value = tutorId;

    let tutorNomeDiv = document.getElementById('clienteSelecionadoNome');
    if (!tutorNomeDiv) {
        tutorNomeDiv = document.createElement('div');
        tutorNomeDiv.id = 'clienteSelecionadoNome';
        tutorNomeDiv.style.display = 'none';
        document.body.appendChild(tutorNomeDiv);
    }
    tutorNomeDiv.textContent = tutorNome;

    // Aguardar um momento para garantir que o modal e formulário estão montados
    setTimeout(() => {
        // Buscar e preencher o primeiro pet do cliente
        const cliente = clientesCache.find(c => c.tutor_id == tutorId);
        if (cliente && cliente.pets && cliente.pets.length > 0) {
            const primeiroPet = cliente.pets[0];

            // Preencher campos de pet no formulário visível
            const inputPet = document.getElementById('petNome');
            const inputPetId = document.getElementById('petId');

            if (inputPet && inputPetId) {
                inputPet.value = primeiroPet.nome;
                inputPetId.value = primeiroPet.id;

                // Disparar evento de input para ativar autocomplete e atualizar UI
                const event = new Event('input', { bubbles: true });
                inputPet.dispatchEvent(event);

                // Também disparar blur para confirmar seleção
                setTimeout(() => {
                    inputPet.dispatchEvent(new Event('blur', { bubbles: true }));
                }, 100);
            }
        }

        // Configurar uso do pacote (banner de aviso)
        setTimeout(() => {
            usarPacote(clientePacoteId);
        }, 200);
    }, 150);
}

// Função para limpar completamente o uso de pacote (chamada ao fechar modal ou salvar)
function limparUsoPacote() {
    // Remover campo hidden
    const hiddenInput = document.getElementById('usoPacoteId');
    if (hiddenInput) {
        hiddenInput.remove();
    }

    // Remover aviso visual
    const avisoDiv = document.getElementById('avisoPacoteAtivo');
    if (avisoDiv) {
        avisoDiv.remove();
    }
}

// Função para cancelar uso do pacote (chamada pelo botão no banner)
function cancelarUsoPacote() {
    limparUsoPacote();
    mostrarNotificacao('Uso de pacote cancelado', 'info');
}

// ========== MODAL DE ESCOLHA DE VENDA ==========

function mostrarModalEscolhaVenda(pacoteId, tutorId, pacote) {
    const clienteNome = document.getElementById('clienteSelecionadoNome').textContent;
    const modalHtml = `<div id="modalEscolhaVenda" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;"><div style="background: var(--bg-secondary); padding: 2rem; border-radius: 16px; max-width: 500px; width: 90%; border: 1px solid var(--border-color); box-shadow: 0 20px 60px rgba(0,0,0,0.5);"><h3 style="margin-bottom: 0.5rem; color: var(--primary-gold); font-size: 1.3rem;">💰 Vender Pacote</h3><p style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.95rem;"><strong style="color: var(--light-purple);">${pacote.nome}</strong> para <strong>${clienteNome}</strong><br>Valor: <strong style="color: var(--primary-gold);">${formatarMoeda(pacote.valor)}</strong></p><div style="display: flex; flex-direction: column; gap: 1rem;"><button onclick="venderComPagamento(${pacoteId}, ${tutorId})" style="padding: 1.25rem; font-size: 1.1rem; border-radius: 12px; border: 2px solid #10B981; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%); color: #10B981; cursor: pointer; font-weight: 600;">✅ Pagar Agora<div style="font-size: 0.85rem; font-weight: 400; margin-top: 0.25rem; opacity: 0.8;">Escolher forma de pagamento</div></button><button onclick="venderAPrazoConfirmar(${pacoteId}, ${tutorId})" style="padding: 1.25rem; font-size: 1.1rem; border-radius: 12px; border: 2px solid #F59E0B; background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%); color: #F59E0B; cursor: pointer; font-weight: 600;">⏳ Vender a Prazo<div style="font-size: 0.85rem; font-weight: 400; margin-top: 0.25rem; opacity: 0.8;">Cliente paga depois</div></button><button onclick="fecharModalEscolhaVenda()" style="padding: 0.75rem; font-size: 0.95rem; border-radius: 12px; border: none; background: #6B7280; color: white; cursor: pointer; margin-top: 0.5rem;">Cancelar</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharModalEscolhaVenda() {
    const modal = document.getElementById('modalEscolhaVenda');
    if (modal) modal.remove();
}

function venderComPagamento(pacoteId, tutorId) {
    fecharModalEscolhaVenda();
    const pacote = pacotesState.lista.find(p => p.id === pacoteId);
    abrirModalFormaPagamentoPacote(pacoteId, tutorId, pacote);
}

function venderAPrazoConfirmar(pacoteId, tutorId) {
    fecharModalEscolhaVenda();
    const pacote = pacotesState.lista.find(p => p.id === pacoteId);
    venderPacoteAPrazo(pacoteId, tutorId, pacote);
}

// Interceptar o submit do form em app.js para processar o pacote?
// Sim, preciso alterar app.js mais uma vez para verificar 'usoPacoteId'.

// === Seleção de Pets no Modal ===
async function agendarComPacote(clientePacoteId, tutorId, tutorNome) {
    window.pacoteAgendamentoAtivo = {
        clientePacoteId,
        tutorId,
        tutorNome
    };

    try {
        const response = await fetchComAuth(`${API_URL}/pets?tutor_id=${tutorId}`);
        const pets = await response.json();

        if (!pets || pets.length === 0) {
            alert('Este tutor não possui pets cadastrados.');
            return;
        }

        mostrarSeletorPets(pets, tutorNome);
    } catch (error) {
        console.error('Erro ao buscar pets:', error);
        alert('Erro ao buscar pets do cliente');
    }
}

function mostrarSeletorPets(pets, tutorNome) {
    const modal = document.getElementById('modalSeletorPets');
    const lista = document.getElementById('listaPetsSelecao');

    lista.innerHTML = pets.map(pet => `
        <label style="display: flex; align-items: center; padding: 0.75rem; 
                      border: 1px solid var(--border-color); border-radius: 8px; 
                      margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s ease;">
            <input type="checkbox" name="petSelecionado" value="${pet.id}" 
                   data-nome="${pet.nome}" style="margin-right: 0.75rem;">
            <span style="font-size: 1rem;">🐾 ${pet.nome}</span>
        </label>
    `).join('') + `
        <label style="display: flex; align-items: center; padding: 0.75rem; 
                      border: 2px solid var(--primary-gold); border-radius: 8px; 
                      margin-top: 0.75rem; cursor: pointer; background: rgba(245, 158, 11, 0.1); 
                      transition: all 0.2s ease;">
            <input type="checkbox" id="todosOsPets" 
                   onchange="selecionarTodosPets(this)" 
                   style="margin-right: 0.75rem;">
            <span style="font-weight: 600; color: var(--primary-gold); font-size: 1.05rem;">🐾 Todos</span>
        </label>
    `;

    modal.style.display = 'flex';
    fecharModalGestaoAssinaturas(); // Fechar modal anterior
}

function selecionarTodosPets(checkbox) {
    const checkboxes = document.querySelectorAll('input[name="petSelecionado"]');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        cb.disabled = checkbox.checked;
    });
}

function confirmarSelecaoPets() {
    const todosSelecionado = document.getElementById('todosOsPets').checked;
    const checkboxes = document.querySelectorAll('input[name="petSelecionado"]:checked');

    let nomePet;

    if (todosSelecionado) {
        const allCheckboxes = document.querySelectorAll('input[name="petSelecionado"]');
        const nomes = Array.from(allCheckboxes).map(cb => cb.dataset.nome);
        nomePet = nomes.join(', ');
    } else if (checkboxes.length === 1) {
        nomePet = checkboxes[0].dataset.nome;
    } else if (checkboxes.length > 1) {
        nomePet = Array.from(checkboxes).map(cb => cb.dataset.nome).join(', ');
    } else {
        alert('Selecione pelo menos um pet.');
        return;
    }

    // Fechar seletor
    fecharModalSeletorPets();

    // Abrir modal simplificado de agendamento de pacote
    abrirModalAgendamentoPacote(
        window.pacoteAgendamentoAtivo.tutorNome,
        nomePet,
        window.pacoteAgendamentoAtivo.clientePacoteId
    );
}

function fecharModalSeletorPets() {
    document.getElementById('modalSeletorPets').style.display = 'none';
}

// === Modal Agendamento de Pacote (Simplificado) ===
function abrirModalAgendamentoPacote(tutorNome, petNomes, clientePacoteId) {
    const modal = document.getElementById('modalAgendamentoPacote');
    const form = document.getElementById('formAgendamentoPacote');

    // Limpar form
    form.reset();
    document.getElementById('pacoteServicosExtras').innerHTML = '';

    // Preencher campos readonly
    document.getElementById('pacoteTutorNome').value = tutorNome;
    document.getElementById('pacotePetNome').value = petNomes;
    document.getElementById('pacoteClientePacoteId').value = clientePacoteId;

    // Data padrão: hoje
    document.getElementById('pacoteData').value = new Date().toISOString().split('T')[0];

    // Abrir modal
    modal.style.display = 'flex';
}

function fecharModalAgendamentoPacote() {
    document.getElementById('modalAgendamentoPacote').style.display = 'none';
}

let pacoteExtraCounter = 0;

function adicionarServicoExtraPacote() {
    pacoteExtraCounter++;
    const container = document.getElementById('pacoteServicosExtras');

    const extraDiv = document.createElement('div');
    extraDiv.className = 'servico-extra-item';
    extraDiv.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
    extraDiv.innerHTML = `
        <input type="text" class="form-input pacote-extra-nome" placeholder="Nome do serviço" style="flex: 2;">
        <input type="number" class="form-input pacote-extra-valor" placeholder="R$" step="0.01" min="0" style="flex: 1;">
        <button type="button" class="btn-secondary" onclick="this.parentElement.remove()" 
                style="padding: 0.5rem; width: 40px;">×</button>
    `;

    container.appendChild(extraDiv);
}

async function salvarAgendamentoPacote(event) {
    event.preventDefault();

    const tutorNome = document.getElementById('pacoteTutorNome').value;
    const petNome = document.getElementById('pacotePetNome').value;
    const data = document.getElementById('pacoteData').value;
    const hora = document.getElementById('pacoteHora').value;
    const clientePacoteId = document.getElementById('pacoteClientePacoteId').value;
    const taxiBuscar = document.getElementById('pacoteTaxiBuscar').checked;
    const taxiLevar = document.getElementById('pacoteTaxiLevar').checked;
    const observacoes = document.getElementById('pacoteObservacoes').value;

    // Coletar serviços extras
    const extrasNomes = document.querySelectorAll('.pacote-extra-nome');
    const extrasValores = document.querySelectorAll('.pacote-extra-valor');
    const servicosExtras = [];

    extrasNomes.forEach((input, index) => {
        if (input.value.trim()) {
            servicosExtras.push({
                nome: input.value,
                preco: parseFloat(extrasValores[index].value) || 0
            });
        }
    });

    // Montar objeto de agendamento
    const agendamento = {
        pet_nome: petNome,
        pet_id: null,
        data: data,
        hora_inicio: hora + ':00',
        duracao_minutos: 60,
        servicos: [], // Vazio para pacote
        servicos_extras: servicosExtras,
        valores_customizados: {},
        desconto_tipo: 'valor',
        desconto_valor: 0,
        valor_total: servicosExtras.reduce((sum, s) => sum + s.preco, 0),
        pago: false,
        taxi_buscar: taxiBuscar,
        taxi_levar: taxiLevar,
        observacoes: observacoes,
        unidade_id: 1,
        cliente_pacote_id: parseInt(clientePacoteId),
        sem_custo: false
    };

    mostrarLoading(true);

    try {
        // Salvar agendamento
        const response = await fetchComAuth(`${API_URL}/agendamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agendamento)
        });

        if (!response.ok) throw new Error('Erro ao salvar');

        // Consumir crédito do pacote
        await fetchComAuth(`${API_URL}/pacotes/consumir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_pacote_id: clientePacoteId })
        });

        mostrarNotificacao('✅ Agendamento realizado e crédito consumido!', 'success');
        fecharModalAgendamentoPacote();
        fecharModalGestaoAssinaturas();
        await carregarAgendamentos();

    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao salvar agendamento', 'error');
    } finally {
        mostrarLoading(false);
    }
}

// Deletar tipo de pacote do catlogo
async function deletarTipoPacote(pacoteId, pacoteNome) {
    if (!confirm(`Tem certeza que deseja EXCLUIR o pacote "${pacoteNome}" do catlogo?

Esta ao no pode ser revertida.`)) {
        return;
    }

    try {
        await fetchComAuth(`${API_URL}/pacotes/${pacoteId}`, {
            method: 'DELETE'
        });

        mostrarNotificacao('Pacote excludo do catlogo!', 'success');
        await buscarPacotesDisponiveis(); // Recarregar lista
        renderizarPacotesVenda();
    } catch (error) {
        console.error('Erro ao excluir pacote:', error);
        mostrarNotificacao('Erro ao excluir pacote!', 'error');
    }
}





function fecharModalControleAssinaturas() {
    document.getElementById('modalControleAssinaturas').style.display = 'none';
}


// Função para filtrar pacotes exibidos por nome do tutor
function filtrarPacotesPorTutor(busca) {
    const termo = busca.toLowerCase().trim();
    const cards = document.querySelectorAll('#listaPacotesDisponiveis .card-pacote');

    cards.forEach(card => {
        // Buscar dentro do card pelo nome do pacote (está no primeiro div com font-weight: 600)
        const nomePacote = card.querySelector('[style*="font-weight: 600"]')?.textContent || '';
        const pacoteMatch = nomePacote.toLowerCase().includes(termo);

        card.style.display = pacoteMatch || termo === '' ? 'block' : 'none';
    });
}


// ===== MODAL NOVA ASSINATURA =====

// Abrir modal Nova Assinatura
function abrirModalNovaAssinatura(assinaturaId = null) {
    const modal = document.getElementById('modalNovaAssinatura');
    const form = document.getElementById('formNovaAssinatura');

    // IMPORTANTE: Remover classe active primeiro para garantir que possa ser adicionada novamente
    modal.classList.remove('active');

    // Limpar form completamente
    setTimeout(() => {
        form.reset();
        document.getElementById('assinaturaId').value = '';
        document.getElementById('assinaturaClienteId').value = '';
        document.getElementById('assinaturaBuscaCliente').value = '';
        document.getElementById('assinaturaClienteInfo').innerHTML = '';
        document.getElementById('assinaturaClienteSugestoes').style.display = 'none';

        // Resetar checkboxes de taxi
        document.getElementById('assinaturaTaxiBuscar').checked = false;
        document.getElementById('assinaturaTaxiLevar').checked = false;
        document.getElementById('assinaturaTaxiSemCusto').checked = false;

        // Se editando, carregar dados
        if (assinaturaId) {
            document.getElementById('tituloAssinatura').textContent = '✏️ Editar Assinatura';
            carregarDadosAssinatura(assinaturaId);
        } else {
            document.getElementById('tituloAssinatura').textContent = '➕ Nova Assinatura';
        }

        // Abrir modal
        modal.classList.add('active');
        console.log('Modal Nova Assinatura aberto');
    }, 50);
}

// Fechar modal
function fecharModalNovaAssinatura() {
    const modal = document.getElementById('modalNovaAssinatura');
    modal.classList.remove('active');
}

// Carregar serviços disponíveis
async function carregarServicosAssinatura() {
    try {
        const response = await fetchComAuth(`${API_URL}/servicos`);
        const servicos = await response.json();

        const container = document.getElementById('assinaturaServicos');
        container.innerHTML = servicos.map(s => `
            <label class="service-checkbox">
                <input type="checkbox" name="servicoAssinatura" value="${s.id}" data-nome="${s.nome}">
                <span>${s.nome}</span>
            </label>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

// Buscar cliente (autocomplete)
let timeoutBuscaCliente;
async function buscarClienteAssinatura(termo) {
    clearTimeout(timeoutBuscaCliente);

    const sugestoes = document.getElementById('assinaturaClienteSugestoes');

    if (termo.length < 2) {
        sugestoes.style.display = 'none';
        return;
    }

    timeoutBuscaCliente = setTimeout(async () => {
        try {
            const response = await fetchComAuth(`${API_URL}/tutores?busca=${termo}`);
            const clientes = await response.json();

            if (clientes.length > 0) {
                sugestoes.innerHTML = clientes.map(c => `
                    <div class="suggestion-item" onclick="selecionarClienteAssinatura(${c.id}, '${c.nome}')">
                        <strong>${c.nome}</strong>
                        <div style="font-size: 0.9em; color: var(--text-secondary);">
                            ${c.telefone || 'Sem telefone'}
                        </div>
                    </div>
                `).join('');
                sugestoes.style.display = 'block';
            } else {
                sugestoes.innerHTML = '<div class="suggestion-item">Nenhum cliente encontrado</div>';
                sugestoes.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
        }
    }, 300);
}

// Selecionar cliente da lista
function selecionarClienteAssinatura(id, nome) {
    document.getElementById('assinaturaClienteId').value = id;
    document.getElementById('assinaturaBuscaCliente').value = nome;
    document.getElementById('assinaturaClienteInfo').innerHTML = `✓ Cliente selecionado: <strong>${nome}</strong>`;
    document.getElementById('assinaturaClienteSugestoes').style.display = 'none';
}

// Salvar assinatura
async function salvarAssinatura() {
    try {
        const clienteId = document.getElementById('assinaturaClienteId').value;

        if (!clienteId) {
            alert('Por favor, selecione um cliente');
            return;
        }

        // Coletar serviços selecionados
        const servicosSelecionados = Array.from(document.querySelectorAll('input[name="servicoAssinatura"]:checked'))
            .map(cb => ({
                id: parseInt(cb.value),
                nome: cb.dataset.nome
            }));

        const dados = {
            cliente_id: parseInt(clienteId),
            nome_plano: document.getElementById('assinaturaNomePlano').value + ' - ' + document.getElementById('assinaturaBuscaCliente').value,
            servicos_incluidos: JSON.stringify(servicosSelecionados),
            creditos_total: parseInt(document.getElementById('assinaturaCreditos').value),
            creditos_usados: 0,
            validade_dias: 30, // Padrão
            data_inicio: new Date().toISOString().split('T')[0], // Hoje
            valor_total: parseFloat(document.getElementById('assinaturaValor').value),
            status_pagamento: 'pendente', // Padrão
            ativo: true,
            observacoes: document.getElementById('assinaturaObs').value
        };

        const assinaturaId = document.getElementById('assinaturaId').value;
        const url = assinaturaId
            ? `${API_URL}/assinaturas/${assinaturaId}`
            : `${API_URL}/assinaturas`;
        const method = assinaturaId ? 'PUT' : 'POST';

        const response = await fetchComAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (response.ok) {
            mostrarNotificacao(`Assinatura ${assinaturaId ? 'atualizada' : 'criada'} com sucesso!`, 'success');
            fecharModalNovaAssinatura();
            // Recarregar lista
            carregarTodasAssinaturasAtivas();
        } else {
            const error = await response.json();
            mostrarNotificacao('Erro ao salvar assinatura: ' + (error.error || 'Erro desconhecido'), 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar assinatura:', error);
        mostrarNotificacao('Erro ao salvar assinatura', 'error');
    }
}

// Carregar dados de assinatura (para edição)
async function carregarDadosAssinatura(id) {
    try {
        const response = await fetchComAuth(`${API_URL}/assinaturas/${id}`);
        const assinatura = await response.json();

        document.getElementById('assinaturaId').value = assinatura.id;
        document.getElementById('assinaturaClienteId').value = assinatura.cliente_id;
        document.getElementById('assinaturaBuscaCliente').value = assinatura.cliente_nome || '';
        document.getElementById('assinaturaClienteInfo').innerHTML = `✓ Cliente: <strong>${assinatura.cliente_nome}</strong>`;
        document.getElementById('assinaturaNomePlano').value = assinatura.nome_plano;
        document.getElementById('assinaturaCreditos').value = assinatura.creditos_total;
        document.getElementById('assinaturaValidade').value = assinatura.validade_dias;
        document.getElementById('assinaturaValor').value = assinatura.valor_total;
        document.getElementById('assinaturaDataInicio').value = assinatura.data_inicio;
        document.getElementById('assinaturaPago').checked = assinatura.status_pagamento === 'pago';
        document.getElementById('assinaturaObs').value = assinatura.observacoes || '';

        // Marcar serviços selecionados
        const servicosIncluidos = JSON.parse(assinatura.servicos_incluidos || '[]');
        servicosIncluidos.forEach(s => {
            const checkbox = document.querySelector(`input[name="servicoAssinatura"][value="${s.id}"]`);
            if (checkbox) checkbox.checked = true;
        });
    } catch (error) {
        console.error('Erro ao carregar assinatura:', error);
        mostrarNotificacao('Erro ao carregar dados da assinatura', 'error');
    }
}


// ===== LISTAR ASSINANTES =====

// Carregar e renderizar clientes com pacotes
async function carregarClientesComPacotes() {
    try {
        console.log('📦 Carregando assinantes...');

        const response = await fetchComAuth(`${API_URL}/assinaturas`);
        const assinaturas = await response.json();

        renderizarListaAssinantes(assinaturas);
        console.log(`✅ ${assinaturas.length} assinatura(s) carregada(s)`);
    } catch (error) {
        console.error('Erro ao carregar assinaturas:', error);
        mostrarNotificacao('Erro ao carregar assinaturas', 'error');
    }
}

// Renderizar cards de assinantes
function renderizarListaAssinantes(assinaturas) {
    const container = document.getElementById('listaClientesComPacotes');

    if (assinaturas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">📦 Nenhuma assinatura ativa</p>
                <p>Crie sua primeira assinatura clicando no botão acima</p>
            </div>
        `;
        return;
    }

    container.innerHTML = assinaturas.map(a => {
        const creditosRestantes = a.creditos_total - a.creditos_usados;
        const percentualUsado = (a.creditos_usados / a.creditos_total) * 100;

        // Determinar cor da barra de progresso
        let corBarra = 'var(--success-green)';
        if (percentualUsado > 75) corBarra = 'var(--error-red)';
        else if (percentualUsado > 50) corBarra = 'var(--warning-yellow)';

        // Status
        let statusBadge = '';
        if (a.status === 'expirado') {
            statusBadge = '<span style="background: var(--error-red); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">Expirado</span>';
        } else if (a.status_pagamento === 'pendente') {
            statusBadge = '<span style="background: var(--warning-yellow); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">Pagamento Pendente</span>';
        }

        return `
            <div class="card" style="margin-bottom: 1rem; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="margin: 0 0 0.5rem 0; color: var(--primary-purple);">${a.nome_plano}</h3>
                        <p style="margin: 0; color: var(--text-secondary);">
                            👤 ${a.cliente_nome} • 📞 ${a.cliente_telefone || 'Sem telefone'}
                        </p>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>
                
                <!-- Barra de Créditos -->
                <div style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600;">Créditos</span>
                        <span style="color: var(--primary-purple); font-weight: 600;">
                            ${creditosRestantes} / ${a.creditos_total} restantes
                        </span>
                    </div>
                    <div style="background: #e0e0e0; border-radius: 8px; height: 8px; overflow: hidden;">
                        <div style="background: ${corBarra}; width: ${100 - percentualUsado}%; height: 100%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                <!-- Info adicional -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem; font-size: 0.9rem;">
                    <div>📅 Início: ${new Date(a.data_inicio).toLocaleDateString('pt-BR')}</div>
                    <div>⏰ Validade: ${new Date(a.data_fim).toLocaleDateString('pt-BR')}</div>
                    <div>💰 Valor: R$ ${parseFloat(a.valor_total).toFixed(2)}</div>
                    <div>📊 Status: ${a.status_pagamento === 'pago' ? '✅ Pago' : '⏳ Pendente'}</div>
                </div>
                
                <!-- Botões de Ação -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn-primary" onclick="agendarComPacote(${a.id})" 
                            ${creditosRestantes === 0 ? 'disabled' : ''} 
                            style="flex: 1; min-width: 150px;">
                        📅 Agendar
                    </button>
                    <button class="btn-secondary" onclick="abrirModalNovaAssinatura(${a.id})" 
                            style="flex: 1; min-width: 150px;">
                        ✏️ Editar
                    </button>
                    <button class="btn-secondary" onclick="gerenciarPagamento(${a.id})" 
                            style="flex: 1; min-width: 150px;">
                        💰 Pagamento
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ========== FUNÇÕES DE ASSINATURA (NOVA TABELA) ==========

// Pagar assinatura via modal (design igual ao avulso)
async function pagarAssinaturaModal(assinaturaId, nomePlano, valor) {
    const formaSelecionada = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
                    <h2 style="width: 100%; text-align: center;">💰 Forma de Pagamento</h2>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <div style="color: var(--primary-gold); font-weight: 600; font-size: 1.1rem;">${nomePlano}</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-top: 0.5rem;">R$ ${valor.toFixed(2)}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button class="btn-forma-pagamento" style="width: 100%; height: 50px; font-size: 1rem; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white;" 
                                onclick="this.closest('.modal').dataset.forma='dinheiro'; this.closest('.modal').remove();">
                            💵 Dinheiro
                        </button>
                        <button class="btn-forma-pagamento" style="width: 100%; height: 50px; font-size: 1rem; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white;" 
                                onclick="this.closest('.modal').dataset.forma='pix'; this.closest('.modal').remove();">
                            📱 PIX
                        </button>
                        <button class="btn-forma-pagamento" style="width: 100%; height: 50px; font-size: 1rem; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%); color: white;" 
                                onclick="this.closest('.modal').dataset.forma='cartao'; this.closest('.modal').remove();">
                            💳 Cartão
                        </button>
                        <button class="btn-forma-pagamento" style="width: 100%; height: 50px; font-size: 1rem; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; margin-top: 0.5rem;" 
                                onclick="this.closest('.modal').remove();">
                            ❌ Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(modal)) {
                resolve(modal.dataset.forma || null);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    });

    if (!formaSelecionada) return;

    try {
        const response = await fetchComAuth(`${API_URL}/assinaturas/${assinaturaId}/pagar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forma_pagamento: formaSelecionada })
        });

        if (response.ok) {
            mostrarNotificacao('Pagamento registrado!', 'success');
            carregarTodasAssinaturasAtivas();
        }
    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao registrar pagamento', 'error');
    }
}

// Agendar com assinatura (usa crédito)
function agendarComAssinatura(assinaturaId, clienteId, clienteNome, creditosRestantes) {
    // O modal de agendamento já está aberto (estamos na aba Assinatura)
    // Trocar para aba Avulso onde está o formulário
    switchAgendamentoTab('avulso');

    // Pré-preencher cliente após troca de aba
    setTimeout(() => {
        // Preencher o campo de busca de tutor e petNome
        const tutorBuscaInput = document.getElementById('tutorBusca');
        const petNomeInput = document.getElementById('petNome');

        if (tutorBuscaInput) {
            tutorBuscaInput.value = clienteNome || '';
        }
        if (petNomeInput) {
            petNomeInput.value = clienteNome || '';
            petNomeInput.dataset.assinaturaId = assinaturaId;
            petNomeInput.dataset.creditosRestantes = creditosRestantes || 1;
        }

        // Marcar como modo assinatura (pula validação de serviços)
        document.getElementById('formAgendamento')?.setAttribute('data-assinatura-mode', 'true');

        mostrarNotificacao(`Agendando para ${clienteNome || 'Cliente'} (${creditosRestantes || 1} crédito${(creditosRestantes || 1) > 1 ? 's' : ''})`, 'info');
    }, 150);
}

// Renovar assinatura
async function renovarAssinaturaModal(assinaturaId, creditosAtual, valorAtual) {
    const novoCreditos = prompt('Quantidade de créditos para renovação:', creditosAtual);
    if (!novoCreditos) return;

    const novoValor = prompt('Valor para renovação (R$):', valorAtual);
    if (!novoValor) return;

    try {
        const response = await fetchComAuth(`${API_URL}/assinaturas/${assinaturaId}/renovar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creditos_total: parseInt(novoCreditos),
                valor_total: parseFloat(novoValor)
            })
        });

        if (response.ok) {
            mostrarNotificacao('Assinatura renovada! Aguardando pagamento.', 'success');
            carregarTodasAssinaturasAtivas();
        }
    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao renovar', 'error');
    }
}

// Cancelar assinatura
async function cancelarAssinaturaModal(assinaturaId, nomePlano) {
    if (!confirm(`Cancelar assinatura "${nomePlano}"?`)) return;

    try {
        const response = await fetchComAuth(`${API_URL}/assinaturas/${assinaturaId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            mostrarNotificacao('Assinatura cancelada', 'success');
            carregarTodasAssinaturasAtivas();
        }
    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao cancelar', 'error');
    }
}

// Cancelar pagamento de assinatura (estorno)
async function cancelarPagamentoAssinaturaModal(assinaturaId, nomePlano) {
    if (!confirm(`Cancelar o pagamento de "${nomePlano}"? O status voltará para Pendente.`)) return;

    try {
        const response = await fetchComAuth(`${API_URL}/assinaturas/${assinaturaId}/cancelar-pagamento`, {
            method: 'PATCH'
        });

        if (response.ok) {
            mostrarNotificacao('Pagamento cancelado', 'success');
            carregarTodasAssinaturasAtivas();
        }
    } catch (e) {
        console.error(e);
        mostrarNotificacao('Erro ao cancelar pagamento', 'error');
    }
}

// Modal de Datas - mostra agendamentos da assinatura
async function abrirModalDatasAssinatura(assinaturaId, nomePlano, clienteNome) {
    // Buscar agendamentos vinculados
    try {
        const response = await fetchComAuth(`${API_URL}/agendamentos?assinatura_id=${assinaturaId}`);
        const agendamentos = await response.json();

        // Formatar lista de datas
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        let listaHtml = '';
        if (agendamentos && agendamentos.length > 0) {
            listaHtml = agendamentos.map((a, i) => {
                const data = new Date(a.data + 'T00:00:00');
                const diaSemana = diasSemana[data.getDay()];
                const dataFormatada = data.toLocaleDateString('pt-BR');
                const hora = a.hora_inicio ? a.hora_inicio.substring(0, 5) : '';

                return `
                    <div style="display: flex; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);">
                        <span style="color: #7C3AED; font-weight: 700; font-size: 1.2rem; min-width: 40px;">#${i + 1}</span>
                        <span style="flex: 1; font-weight: 500;">${diaSemana}</span>
                        <span style="text-align: right;">
                            <strong>${dataFormatada}</strong><br>
                            <span style="color: var(--text-secondary); font-size: 0.9rem;">${hora}</span>
                        </span>
                    </div>
                `;
            }).join('');
        } else {
            listaHtml = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhum agendamento registrado.</p>';
        }

        // Criar modal
        const modalHtml = `
            <div id="modalDatasAssinatura" class="modal active" onclick="if(event.target===this)this.remove()">
                <div class="modal-content" style="max-width: 500px; text-align: center;">
                    
                    <!-- Logo (clique para fechar) -->
                    <div style="padding: 2rem 0; cursor: pointer;" onclick="this.closest('.modal').remove()" title="Clique para fechar">
                        <img src="logo-halfeld.png" alt="Halfeld PetCare" style="max-width: 200px; margin: 0 auto;">
                    </div>
                    
                    <!-- Info Pet/Cliente -->
                    <div style="background: var(--bg-tertiary); padding: 1rem 1.5rem; border-radius: 8px; margin: 0 1rem 1rem 1rem;">
                        <div style="color: var(--primary-gold); font-weight: 600; font-size: 1.1rem;">${nomePlano}</div>
                        <div style="color: var(--text-secondary);">Cliente: <strong>${clienteNome}</strong></div>
                    </div>
                    
                    <!-- Lista de Datas -->
                    <div style="text-align: left; max-height: 300px; overflow-y: auto; margin: 0 0.5rem;">
                        ${listaHtml}
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior se existir
        const existente = document.getElementById('modalDatasAssinatura');
        if (existente) existente.remove();

        // Adicionar ao DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (e) {
        console.error('Erro ao buscar datas:', e);
        mostrarNotificacao('Erro ao carregar datas', 'error');
    }
}
