// ========== GESTÃO DE CLIENTES ==========

let clienteEditando = null;
let petIdCounter = 0;

// Abrir modal de clientes
function abrirModalClientes() {
    const modal = document.getElementById('modalClientes');
    modal.classList.add('active');

    // Resetar scroll para o topo
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.scrollTop = 0;
    }

    // Resetar para a tab de cadastro
    // Assuming switchClienteTab is a new function or a typo for mudarTabClientes
    // If it's a new function, it should be defined elsewhere.
    // For now, I'll assume it's intended to be mudarTabClientes based on existing code.
    mudarTabClientes('cadastrar'); // Changed from switchClienteTab to mudarTabClientes

    // Limpar formulários
    // Assuming formNovoCliente and pets-container are elements in the form
    const formNovoCliente = document.getElementById('formNovoCliente');
    if (formNovoCliente) {
        formNovoCliente.reset();
    }
    const petsContainer = document.getElementById('petsContainer'); // Changed from pets-container to petsContainer based on existing code
    if (petsContainer) {
        petsContainer.innerHTML = '';
    }

    // Carregar lista de clientes automaticamente


    document.getElementById('modalClientesTitle').textContent = '👥 Gestão de Clientes';
    limparFormularioCliente();

    // Controlar acesso à tab de cadastrar baseado em permissão
    const canManage = state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'gerente');
    const tabCadastrar = document.querySelector('.tab-btn[data-tab="cadastrar"]');
    if (tabCadastrar) {
        tabCadastrar.style.display = canManage ? 'inline-block' : 'none';
    }

    // Controlar acesso aos botões Excel
    const excelControls = document.getElementById('excelControls');
    if (excelControls) {
        excelControls.style.display = canManage ? 'flex' : 'none';
    }

    mudarTabClientes('buscar'); // Abrir na aba de busca
    carregarTodosOsClientesModal(); // Carregar lista automaticamente
}

// Fechar modal de clientes
function fecharModalClientes() {
    document.getElementById('modalClientes').classList.remove('active');
    clienteEditando = null;
    limparFormularioCliente();
    mudarTabClientes('cadastrar'); // Volta para tab de cadastrar
}

// Mudar tab
function mudarTabClientes(tab) {
    // Atualizar active nos botões
    document.querySelectorAll('#modalClientes .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const btnAtivo = document.querySelector(`#modalClientes .tab-btn[data-tab="${tab}"]`);
    if (btnAtivo) {
        btnAtivo.classList.add('active');
    }

    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabElement = document.getElementById(`tab-${tab}`);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Carregar dados específicos da tab
    if (tab === 'buscar') {
        carregarClientes();
    } else if (tab === 'lembretes') {
        carregarLembretes();
    }
}

// Aplicar máscara de telefone brasileiro
function aplicarMascaraTelefone(e) {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é número

    if (value.length > 11) value = value.slice(0, 11); // Limita a 11 dígitos

    // Aplica a máscara
    if (value.length <= 2) {
        value = value.replace(/(\d{0,2})/, '($1');
    } else if (value.length <= 6) {
        value = value.replace(/(\d{2})(\d{0,4})/, '($1) $2');
    } else if (value.length <= 10) {
        value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else {
        value = value.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
    }

    e.target.value = value;
}



// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    // Configurar tabs dentro do modal
    const tabsModal = document.querySelectorAll('#modalClientes .tab-btn');
    if (tabsModal.length > 0) {
        tabsModal.forEach(btn => {
            btn.addEventListener('click', () => {
                mudarTabClientes(btn.dataset.tab);
            });
        });
    }

    // Configurar botão de clientes
    const btnClientes = document.getElementById('btnClientes');
    if (btnClientes) {
        btnClientes.addEventListener('click', abrirModalClientes);
    }

    // Configurar busca
    const buscaClientes = document.getElementById('buscaClientes');
    if (buscaClientes) {
        let searchTimeout;
        buscaClientes.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                buscarClientes(e.target.value);
            }, 300);
        });
    }

    // Configurar máscara de telefone
    const tutorTelefone = document.getElementById('tutorTelefone');
    if (tutorTelefone) {
        tutorTelefone.addEventListener('input', aplicarMascaraTelefone);
    }

    // Adicionar 1 pet por padrão quando abrir modal
    setTimeout(() => {
        if (document.getElementById('petsContainer') && document.getElementById('petsContainer').children.length === 0) {
            adicionarPet();
        }
    }, 100);
});

function adicionarPet() {
    const container = document.getElementById('petsContainer');
    if (!container) return;

    const petId = `pet-${petIdCounter++}`;

    const petHtml = `
        <div class="pet-form" id="${petId}">
            <div class="pet-form-header">
                <h4>Pet #${petIdCounter}</h4>
                <button type="button" class="btn-close-small" onclick="removerPet('${petId}')">×</button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Nome *</label>
                    <input type="text" name="petNome" required>
                </div>
                <div class="form-group">
                    <label>Raça *</label>
                    <input type="text" name="petRaca" required>
                </div>
                <div class="form-group">
                    <label>Peso (kg) *</label>
                    <input type="number" name="petPeso" step="0.1" min="0" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Data de Nascimento</label>
                    <input type="date" name="petNascimento">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Última aplicação Vermífugo</label>
                    <input type="date" name="petVermifugo">
                </div>
                <div class="form-group">
                    <label>Intervalo entre aplicações</label>
                    <select name="petIntervaloVermifugo">
                        <option value="1">1 mês</option>
                        <option value="2">2 meses</option>
                        <option value="3" selected>3 meses</option>
                        <option value="4">4 meses</option>
                        <option value="5">5 meses</option>
                        <option value="6">6 meses</option>
                        <option value="7">7 meses</option>
                        <option value="8">8 meses</option>
                        <option value="9">9 meses</option>
                        <option value="10">10 meses</option>
                        <option value="11">11 meses</option>
                        <option value="12">12 meses</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Última aplicação Antiparasita</label>
                    <input type="date" name="petAntiparasita">
                </div>
                <div class="form-group">
                    <label>Intervalo entre aplicações</label>
                    <select name="petIntervaloAntiparasita">
                        <option value="1">1 mês</option>
                        <option value="2">2 meses</option>
                        <option value="3" selected>3 meses</option>
                        <option value="4">4 meses</option>
                        <option value="5">5 meses</option>
                        <option value="6">6 meses</option>
                        <option value="7">7 meses</option>
                        <option value="8">8 meses</option>
                        <option value="9">9 meses</option>
                        <option value="10">10 meses</option>
                        <option value="11">11 meses</option>
                        <option value="12">12 meses</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Observações</label>
                    <textarea name="petObservacoes" rows="2"></textarea>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', petHtml);
}

// Remover pet do formulário
function removerPet(petId) {
    const petElement = document.getElementById(petId);
    if (petElement) {
        petElement.remove();
    }
}

// ========== EXCEL IMPORT/EXPORT ==========

async function exportarClientesExcel() {
    try {
        mostrarLoading(true);

        // 1. Buscar todos os tutores e pets
        const rTutores = await fetchComAuth(`${API_URL}/tutores`);
        const tutores = await rTutores.json();

        const rPets = await fetchComAuth(`${API_URL}/pets`);
        const pets = await rPets.json();

        if (!tutores || !pets) throw new Error('Falha ao buscar dados');

        // 2. Processar dados para formato plano (Flat)
        const linhas = [];

        // Mapa de pets por tutor para agilizar
        const petsPorTutor = {};
        pets.forEach(pet => {
            if (!petsPorTutor[pet.tutor_id]) petsPorTutor[pet.tutor_id] = [];
            petsPorTutor[pet.tutor_id].push(pet);
        });

        tutores.forEach(tutor => {
            const tutorPets = petsPorTutor[tutor.id] || [];

            if (tutorPets.length === 0) {
                // Tutor sem pets
                linhas.push({
                    'Nome Tutor': tutor.nome,
                    'Telefone': tutor.telefone,
                    'Endereço': tutor.endereco || '',
                    'Nome Pet': '',
                    'Raça': '',
                    'Peso': '',
                    'Data Nascimento': '',
                    'Observações': tutor.observacoes || ''
                });
            } else {
                tutorPets.forEach(pet => {
                    linhas.push({
                        'Nome Tutor': tutor.nome,
                        'Telefone': tutor.telefone,
                        'Endereço': tutor.endereco || '',
                        'Nome Pet': pet.nome,
                        'Raça': pet.raca,
                        'Peso': pet.peso,
                        'Data Nascimento': pet.data_nascimento || '',
                        'Observações': pet.observacoes || tutor.observacoes || ''
                    });
                });
            }
        });

        // 3. Gerar Excel
        const ws = XLSX.utils.json_to_sheet(linhas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes");

        // 4. Download
        const dataHoje = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Halfeld_Clientes_${dataHoje}.xlsx`);

        mostrarNotificacao('Exportação concluída com sucesso!', 'success');

    } catch (error) {
        console.error('Erro na exportação:', error);
        mostrarNotificacao('Erro ao exportar dados: ' + error.message, 'error');
    } finally {
        mostrarLoading(false);
    }
}

async function importarClientesExcel(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    try {
        mostrarLoading(true);

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            alert('Planilha vazia!');
            return;
        }

        const mapaTutores = {};

        json.forEach(row => {
            const telefone = String(row['Telefone'] || '').replace(/\D/g, '');
            const nomeTutor = row['Nome Tutor'];

            if (!nomeTutor) return;

            if (!mapaTutores[telefone]) {
                mapaTutores[telefone] = {
                    tutor: {
                        nome: nomeTutor,
                        telefone: row['Telefone'],
                        endereco: row['Endereço'],
                        observacoes: row['Observações']
                    },
                    pets: []
                };
            }

            if (row['Nome Pet']) {
                mapaTutores[telefone].pets.push({
                    nome: row['Nome Pet'],
                    raca: row['Raça'],
                    peso: row['Peso'],
                    data_nascimento: row['Data Nascimento'],
                    observacoes: row['Observações']
                });
            }
        });

        const payload = Object.values(mapaTutores);

        const response = await fetchComAuth(`${API_URL}/tutores/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro na importação');
        }

        const result = await response.json();

        let msg = `Importação concluída!\n\nTutores adicionados: ${result.stats.tutors}\nPets adicionados: ${result.stats.pets}`;

        if (result.stats.errors && result.stats.errors.length > 0) {
            msg += `\n\nErros (${result.stats.errors.length}):\n` + result.stats.errors.join('\n');
            alert(msg);
        } else {
            mostrarNotificacao(msg, 'success');
        }

        const tabBuscar = document.querySelector('.tab-btn[data-tab="buscar"]');
        if (tabBuscar && tabBuscar.classList.contains('active')) {
            carregarClientes();
        }

    } catch (error) {
        console.error("Erro na importação:", error);
        mostrarNotificacao('Erro na importação: ' + error.message, 'error');
    } finally {
        mostrarLoading(false);
        input.value = '';
    }
}


// Limpar formulário
function limparFormularioCliente() {
    document.getElementById('formCliente').reset();
    const petsContainer = document.getElementById('petsContainer');
    if (petsContainer) petsContainer.innerHTML = '';
    petIdCounter = 0;
    clienteEditando = null;

    // Adicionar pelo menos 1 pet
    adicionarPet();
}

// Salvar cliente (tutor + pets)
async function salvarCliente(event) {
    event.preventDefault();

    // Verificar permissão
    if (state.currentUser && state.currentUser.role === 'operacao') {
        mostrarNotificacao('Você não tem permissão para cadastrar ou editar clientes', 'error');
        return;
    }

    console.log('=== Iniciando salvamento de cliente ===');

    try {
        // Dados do tutor
        const tutorData = {
            nome: document.getElementById('tutorNome').value,
            telefone: document.getElementById('tutorTelefone').value,
            endereco: document.getElementById('tutorEndereco').value,
            observacoes: document.getElementById('tutorObservacoes').value
        };

        console.log('Dados do tutor:', tutorData);

        let tutorResult;

        // Criar ou atualizar tutor
        if (clienteEditando) {
            console.log('Editando tutor ID:', clienteEditando.tutorId);
            const response = await fetchComAuth(`${API_URL}/tutores/${clienteEditando.tutorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tutorData)
            });
            if (!response.ok) throw new Error('Erro ao atualizar tutor');
            const data = await response.json();
            tutorResult = { id: clienteEditando.tutorId, ...data };
        } else {
            console.log('Criando novo tutor');
            const response = await fetchComAuth(`${API_URL}/tutores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tutorData)
            });
            if (!response.ok) throw new Error('Erro ao criar tutor');
            tutorResult = await response.json();
        }

        console.log('Tutor salvo:', tutorResult);

        // Processar pets
        const petsNoFormulario = [];
        const petForms = document.querySelectorAll('.pet-form');

        petForms.forEach(form => {
            const petData = {
                tutor_id: tutorResult.id,
                nome: form.querySelector('[name="petNome"]').value,
                raca: form.querySelector('[name="petRaca"]').value,
                peso: parseFloat(form.querySelector('[name="petPeso"]').value),
                data_nascimento: form.querySelector('[name="petNascimento"]').value || null,
                data_proximo_vermifugo: form.querySelector('[name="petVermifugo"]').value || null,
                data_proximo_antiparasita: form.querySelector('[name="petAntiparasita"]').value || null,
                intervalo_vermifugo_meses: parseInt(form.querySelector('[name="petIntervaloVermifugo"]').value),
                intervalo_antiparasita_meses: parseInt(form.querySelector('[name="petIntervaloAntiparasita"]').value),
                observacoes: form.querySelector('[name="petObservacoes"]').value
            };

            // Se tiver ID salvo no dataset, adicionar
            if (form.dataset.petId) {
                petData.id = form.dataset.petId;
            }

            petsNoFormulario.push(petData);
        });

        // Se estiver editando, precisamos deletar pets que foram removidos do form
        if (clienteEditando) {
            // Buscar pets atuais do banco
            const response = await fetchComAuth(`${API_URL}/pets/tutor/${clienteEditando.tutorId}`);
            const petsAtuais = await response.json();

            // Encontrar pets que estão no banco mas não no formulário (foram removidos)
            const idsNoFormulario = petsNoFormulario
                .filter(p => p.id)
                .map(p => parseInt(p.id));

            const petsParaDeletar = petsAtuais.filter(p => !idsNoFormulario.includes(p.id));

            for (const pet of petsParaDeletar) {
                console.log('Deletando pet removido:', pet.nome);
                await fetchComAuth(`${API_URL}/pets/${pet.id}`, {
                    method: 'DELETE'
                });
            }
        }

        // Criar ou atualizar pets
        for (const pet of petsNoFormulario) {
            if (pet.id) {
                // Atualizar pet existente
                console.log('Atualizando pet:', pet.nome);
                const response = await fetchComAuth(`${API_URL}/pets/${pet.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pet)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao atualizar pet');
                }
                console.log('Pet atualizado com sucesso:', pet.nome);
            } else {
                // Criar novo pet
                console.log('Criando novo pet:', pet.nome);
                const response = await fetchComAuth(`${API_URL}/pets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pet)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao criar pet');
                }
                console.log('Pet criado com sucesso:', pet.nome);
            }
        }

        console.log('=== Cliente salvo com sucesso! ===');
        mostrarNotificacao('Cliente salvo com sucesso!', 'success');
        fecharModalClientes();

    } catch (error) {
        console.error('=== ERRO ao salvar cliente ===');
        console.error('Erro completo:', error);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        mostrarNotificacao('Erro ao salvar cliente: ' + error.message, 'error');
    }
}

// Buscar clientes
async function buscarClientes(query) {
    if (!query || query.length < 2) {
        // Se não digitou nada ou menos de 2 caracteres, mostrar TODOS os clientes
        carregarClientes();
        return;
    }

    try {
        const response = await fetchComAuth(`${API_URL}/tutores/search?q=${encodeURIComponent(query)}`);
        const tutores = await response.json();

        mostrarResultadosBusca(tutores);
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
    }
}

// Carregar todos os clientes
async function carregarClientes() {
    console.log('📋 Carregando todos os clientes...');
    try {
        const response = await fetchComAuth(`${API_URL}/tutores`);

        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        const tutores = await response.json();

        console.log(`✅ Carregados ${tutores ? tutores.length : 0} tutores`);

        // Validar que tutores é um array
        if (!Array.isArray(tutores)) {
            throw new Error('Resposta inválida do servidor - esperado array de tutores');
        }

        mostrarResultadosBusca(tutores);
    } catch (error) {
        console.error('❌ Erro ao carregar clientes:', error);
        const container = document.getElementById('resultadosBusca');
        if (container) {
            container.innerHTML = '<p class="empty-state" style="color: #EF4444;">Erro ao carregar clientes. Tente novamente.</p>';
        }
    }
}

async function mostrarResultadosBusca(tutores) {
    const container = document.getElementById('resultadosBusca');

    // Validação de segurança
    if (!container) {
        console.error('❌ Container resultadosBusca não encontrado');
        return;
    }

    if (!Array.isArray(tutores)) {
        console.error('❌ tutores não é um array:', tutores);
        container.innerHTML = '<p class="empty-state" style="color: #EF4444;">Erro ao exibir clientes.</p>';
        return;
    }

    if (tutores.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum cliente encontrado</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';

    for (const tutor of tutores) {
        // NÃO buscar pets aqui - causa centenas de requisições simultâneas
        // Pets serão carregados quando clicar em editar

        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-card); transition: transform 0.2s; cursor: pointer;" 
                 onmouseover="this.style.transform='translateX(4px)'; this.style.borderColor='var(--primary-gold)';" 
                 onmouseout="this.style.transform='translateX(0)'; this.style.borderColor='var(--border-color)';">
                
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">
                            👤 ${tutor.nome}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">
                            ${formatarTelefone(tutor.telefone)}
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn-secondary" 
                            onclick="event.stopPropagation(); editarCliente(${tutor.id})" 
                            style="padding: 0.5rem 1.25rem; font-size: 0.9rem; white-space: nowrap;">
                        👁️
                    </button>
                    <button class="btn-delete-icon" 
                            onclick="event.stopPropagation(); deletarCliente(${tutor.id}, '${tutor.nome.replace(/'/g, "\\'")}')" 
                            style="padding: 0.5rem 0.75rem; font-size: 1.1rem;"
                            title="Excluir cliente">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

// Ver detalhes do cliente (modal)
async function verDetalhesCliente(tutorId) {
    // TODO: Implementar modal de detalhes
    console.log('Ver detalhes:', tutorId);
}

// Editar cliente
async function editarCliente(tutorId) {
    try {
        // Buscar dados do tutor
        const tutorResponse = await fetchComAuth(`${API_URL}/tutores/${tutorId}`);
        const tutor = await tutorResponse.json();

        // Buscar pets do tutor
        const petsResponse = await fetchComAuth(`${API_URL}/pets/tutor/${tutorId}`);
        const pets = await petsResponse.json();

        // Preencher formulário
        document.getElementById('tutorNome').value = tutor.nome;
        document.getElementById('tutorTelefone').value = tutor.telefone;
        document.getElementById('tutorEndereco').value = tutor.endereco || '';
        document.getElementById('tutorObservacoes').value = tutor.observacoes || '';

        // Limpar container de pets
        document.getElementById('petsContainer').innerHTML = '';
        petIdCounter = 0;

        // Adicionar pets existentes
        pets.forEach(pet => {
            const currentPetId = petIdCounter; // Capturar ID antes da adição
            adicionarPet();
            const petForm = document.getElementById(`pet-${currentPetId}`);
            if (petForm) {
                petForm.querySelector('[name="petNome"]').value = pet.nome;
                petForm.querySelector('[name="petRaca"]').value = pet.raca;
                petForm.querySelector('[name="petPeso"]').value = pet.peso;
                petForm.querySelector('[name="petNascimento"]').value = pet.data_nascimento || '';
                petForm.querySelector('[name="petVermifugo"]').value = pet.data_proximo_vermifugo || '';
                petForm.querySelector('[name="petAntiparasita"]').value = pet.data_proximo_antiparasita || '';
                petForm.querySelector('[name="petIntervaloVermifugo"]').value = pet.intervalo_vermifugo_meses || 3;
                petForm.querySelector('[name="petIntervaloAntiparasita"]').value = pet.intervalo_antiparasita_meses || 3;
                petForm.querySelector('[name="petObservacoes"]').value = pet.observacoes || '';
                petForm.dataset.petId = pet.id; // Salvar ID para update
            }
        });

        // Se não tem pets, adicionar um formulário vazio
        if (pets.length === 0) {
            adicionarPet();
        }

        // Marcar que está editando
        clienteEditando = { tutorId: tutorId };

        // Mudar para tab de cadastro e abrir modal
        mudarTabClientes('cadastrar');
        document.getElementById('modalClientes').classList.add('active');
        document.getElementById('modalClientesTitle').textContent = '✏️ Editar Cliente';

        mostrarNotificacao('Editando cliente: ' + tutor.nome, 'info');
    } catch (error) {
        console.error('Erro ao carregar cliente:', error);
        mostrarNotificacao('Erro ao carregar dados do cliente!', 'error');
    }
}

// Deletar cliente
async function deletarCliente(tutorId, tutorNome) {
    const confirmacao = confirm(`⚠️ Tem certeza que deseja EXCLUIR o cliente "${tutorNome}" e todos os seus pets?\n\nEsta ação NÃO pode ser desfeita!`);

    if (!confirmacao) return;

    try {
        // Desativar todos os pets do tutor
        const petsResponse = await fetchComAuth(`${API_URL}/pets/tutor/${tutorId}`);
        const pets = await petsResponse.json();

        for (const pet of pets) {
            await fetchComAuth(`${API_URL}/pets/${pet.id}`, {
                method: 'DELETE'
            });
        }

        // Deletar tutor
        await fetchComAuth(`${API_URL}/tutores/${tutorId}`, {
            method: 'DELETE'
        });

        mostrarNotificacao('Cliente excluído com sucesso!', 'success');
        carregarClientes(); // Recarregar lista
    } catch (error) {
        console.error('Erro ao deletar cliente:', error);
        mostrarNotificacao('Erro ao excluir cliente!', 'error');
    }
}

// Carregar lembretes pendentes
async function carregarLembretes() {
    try {
        const response = await fetchComAuth(`${API_URL}/lembretes/pendentes`);
        const lembretes = await response.json();

        mostrarLembretes(lembretes);
    } catch (error) {
        console.error('Erro ao carregar lembretes:', error);
    }
}

// Mostrar lembretes
function mostrarLembretes(lembretes) {
    const container = document.getElementById('lembretesLista');

    if (lembretes.length === 0) {
        container.innerHTML = '<p class="empty-state">✅ Nenhum lembrete pendente</p>';
        return;
    }

    let html = '';

    lembretes.forEach(lembrete => {
        const icone = lembrete.tipo === 'aniversario' ? '🎂' : '💊';
        const titulo = lembrete.tipo === 'aniversario' ? 'Aniversário' : 'Vermífugo';
        const dataEvento = new Date(lembrete.data_evento).toLocaleDateString('pt-BR');

        html += `
            <div class="lembrete-card">
                <div class="lembrete-info">
                    <h4>${icone} ${titulo} de ${lembrete.pet_nome}</h4>
                    <p>Tutor: ${lembrete.tutor_nome}</p>
                    <p>📞 ${lembrete.telefone}</p>
                    <p>📅 Data: ${dataEvento}</p>
                </div>
                <div class="lembrete-actions">
                    <button class="btn-primary" onclick="marcarClienteAvisado(${lembrete.id}, '${lembrete.tipo}', ${lembrete.pet_id})">
                        Cliente Avisado
                    </button>
                    <button class="btn-secondary" onclick="adiarLembrete(${lembrete.id})">
                        Lembrar Depois
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Marcar cliente como avisado
async function marcarClienteAvisado(lembreteId, tipo, petId) {
    try {
        // Marcar lembrete como avisado
        await fetchComAuth(`${API_URL}/lembretes/${lembreteId}/avisar`, {
            method: 'PATCH'
        });

        // Se for vermífugo, atualizar próxima data (+90 dias)
        if (tipo === 'vermifugo') {
            const petResponse = await fetchComAuth(`${API_URL}/pets/${petId}`);
            const pet = await petResponse.json();

            const dataAtual = new Date(pet.data_proximo_vermifugo);
            dataAtual.setDate(dataAtual.getDate() + 90);

            const historico = pet.historico_vermifugo || [];
            historico.push({
                data: pet.data_proximo_vermifugo,
                avisado_em: new Date().toISOString().split('T')[0]
            });

            await fetchComAuth(`${API_URL}/pets/${petId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...pet,
                    data_proximo_vermifugo: dataAtual.toISOString().split('T')[0],
                    historico_vermifugo: historico
                })
            });
        }

        mostrarNotificacao('Cliente marcado como avisado!', 'success');
        carregarLembretes();
    } catch (error) {
        console.error('Erro ao marcar como avisado:', error);
        mostrarNotificacao('Erro ao processar lembrete!', 'error');
    }
}

// Adiar lembrete
async function adiarLembrete(lembreteId) {
    try {
        await fetchComAuth(`${API_URL}/lembretes/${lembreteId}/adiar`, {
            method: 'PATCH'
        });

        mostrarNotificacao('Lembrete adiado para amanhã', 'success');
        carregarLembretes();
    } catch (error) {
        console.error('Erro ao adiar lembrete:', error);
        mostrarNotificacao('Erro ao adiar lembrete!', 'error');
    }
}



// Carregar todos os clientes automaticamente
async function carregarTodosOsClientesModal() {
    try {
        const response = await fetchComAuth(`${API_URL}/tutores`);
        const clientes = await response.json();
        renderizarListaClientes(clientes);
        console.log(`✓ ${clientes.length} clientes carregados`);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}


function formatarTelefone(tel) {
    if (!tel) return '';
    const num = tel.replace(/D/g, '');
    if (num.length === 11) return `(${num.slice(0,2)}) ${num.slice(2,7)}-${num.slice(7)}`;
    if (num.length === 10) return `(${num.slice(0,2)}) ${num.slice(2,6)}-${num.slice(6)}`;
    return tel;
}
