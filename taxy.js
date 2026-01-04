// ========== TAXY SCHEDULE ==========

let taxysData = [];

// Abrir modal
function abrirModalTaxy() {
    const modal = document.getElementById('modalTaxy');
    modal.classList.add('active');

    // Resetar scroll
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;

    carregarTaxysDoDia();
}

// Fechar modal
function fecharModalTaxy() {
    document.getElementById('modalTaxy').classList.remove('active');
}

// Carregar taxys do dia atual
async function carregarTaxysDoDia() {
    try {
        // CORREÇÃO: Usar a data selecionada na agenda, não o dia atual cronológico
        const hoje = document.getElementById('currentDate').value || new Date().toISOString().split('T')[0];
        const unidadeId = state.currentUser?.role === 'admin'
            ? document.getElementById('unidadeSelector')?.value || null
            : state.currentUser?.unidadeId;

        const url = `/api/agendamentos?data=${hoje}${unidadeId ? `&unidade=${unidadeId}` : ''}`;
        const response = await fetchComAuth(url);
        const agendamentos = await response.json();

        // Filtrar apenas agendamentos com taxi
        taxysData = agendamentos
            .filter(ag => ag.taxi_buscar || ag.taxi_levar)
            .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

        renderizarTaxys();
    } catch (error) {
        console.error('Erro ao carregar taxys:', error);
        mostrarNotificacao('Erro ao carregar taxys do dia', 'error');
    }
}

// Renderizar lista de taxys
function renderizarTaxys() {
    const container = document.getElementById('taxyLista');

    if (taxysData.length === 0) {
        container.innerHTML = `
            <div class="taxy-empty">
                <h4>😌 Nenhum taxi agendado para esta data</h4>
                <p>Aproveite o dia tranquilo!</p>
            </div>
        `;
        return;
    }

    // Agrupar por tutor + horário (mesmo dono, mesmo horário = um único item)
    const agrupados = {};
    taxysData.forEach(ag => {
        const chave = `${ag.tutor_nome || 'Sem tutor'}_${ag.hora_inicio}`;
        if (!agrupados[chave]) {
            agrupados[chave] = {
                ...ag,
                pets: [ag.pet_nome]
            };
        } else {
            agrupados[chave].pets.push(ag.pet_nome);
            // Se algum dos agendamentos tem buscar/levar, mantém
            if (ag.taxi_buscar) agrupados[chave].taxi_buscar = true;
            if (ag.taxi_levar) agrupados[chave].taxi_levar = true;
        }
    });

    const grupos = Object.values(agrupados);

    container.innerHTML = grupos.map(ag => {
        const tipoTaxi = ag.taxi_buscar && ag.taxi_levar ? 'ambos' :
            ag.taxi_buscar ? 'buscar' : 'levar';
        const textoTipo = ag.taxi_buscar && ag.taxi_levar ? '🚗 Buscar e Levar' :
            ag.taxi_buscar ? '🚗 Buscar' : '🚗 Levar';

        // Formatar horário sem segundos
        const horarioFormatado = ag.hora_inicio.substring(0, 5) + 'h';

        // Juntar nomes dos pets apenas com emoji
        const nomesFormatados = ag.pets.join(' 🐾 ');

        return `
            <div class="taxy-item">
                <div class="taxy-item-header">
                    <div class="taxy-pet-name">🐾 ${nomesFormatados}</div>
                    <div class="taxy-time">🕐 ${horarioFormatado}</div>
                </div>
                <div class="taxy-details">
                    <div>📍 ${ag.tutor_endereco || 'Endereço não cadastrado'}</div>
                    <div>📞 ${ag.tutor_telefone || 'Telefone não cadastrado'}</div>
                    <span class="taxy-type ${tipoTaxi}">${textoTipo}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Copiar lista formatada
function copiarTaxys() {
    if (taxysData.length === 0) {
        mostrarNotificacao('Nenhum taxi para copiar', 'warning');
        return;
    }

    // Agrupar por tutor + horário (mesma lógica da renderização)
    const agrupados = {};
    taxysData.forEach(ag => {
        const chave = `${ag.tutor_nome || 'Sem tutor'}_${ag.hora_inicio}`;
        if (!agrupados[chave]) {
            agrupados[chave] = {
                ...ag,
                pets: [ag.pet_nome]
            };
        } else {
            agrupados[chave].pets.push(ag.pet_nome);
            if (ag.taxi_buscar) agrupados[chave].taxi_buscar = true;
            if (ag.taxi_levar) agrupados[chave].taxi_levar = true;
        }
    });

    const grupos = Object.values(agrupados);

    const dataInput = document.getElementById('currentDate').value; // YYYY-MM-DD
    const partes = dataInput.split('-');
    const dataFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;

    let texto = `🚗 *TAXYS DO DIA ${dataFmt}*\n\n`;

    grupos.forEach((ag, index) => {
        const tipoTaxi = ag.taxi_buscar && ag.taxi_levar ? '🚗 Buscar e Levar' :
            ag.taxi_buscar ? '🚗 Buscar' : '🚗 Levar';

        // Formatar horário sem segundos
        const horarioFormatado = ag.hora_inicio.substring(0, 5) + 'h';

        // Juntar nomes dos pets apenas com emoji
        const nomesFormatados = ag.pets.join(' 🐾 ');

        texto += `${index + 1}. *${nomesFormatados}*\n`;
        texto += `   🕐 ${horarioFormatado}\n`;
        texto += `   📍 ${ag.tutor_endereco || 'Endereço não cadastrado'}\n`;
        texto += `   📞 ${ag.tutor_telefone || 'N/D'}\n`;
        texto += `   ${tipoTaxi}\n\n`;
    });

    // Copiar para clipboard
    navigator.clipboard.writeText(texto).then(() => {
        mostrarNotificacao('✅ Lista copiada! Cole no WhatsApp', 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        mostrarNotificacao('Erro ao copiar. Tente novamente', 'error');
    });
}
