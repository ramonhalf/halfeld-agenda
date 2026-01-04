// caixa.js - Gerenciamento de Caixa (Frontend)

let caixaTransacaoTipo = 'entrada'; // 'entrada' ou 'saida'

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Adicionar listener ao botão Caixa do Desktop
    const btnCaixa = document.getElementById('btnCaixa');
    if (btnCaixa) {
        btnCaixa.addEventListener('click', abrirModalCaixa);
    }
});

function abrirModalCaixa() {
    // 1. Verificar permissão (apenas Admin/Gerente)
    // Isso já é filtrado pela visualização do botão, mas validamos aqui tb

    // 2. Carregar dados
    carregarCaixaSaldo();
    carregarCaixaExtrato();

    // 3. Abrir Modal
    const modal = document.getElementById('modalCaixa');
    modal.style.display = 'block';
}

function fecharModalCaixa() {
    document.getElementById('modalCaixa').style.display = 'none';
    fecharModalTransacao();
}

async function carregarCaixaSaldo() {
    try {
        const response = await fetchComAuth('/api/caixa/saldo');
        if (!response.ok) throw new Error('Erro ao carregar saldo');

        const data = await response.json();

        const elSaldo = document.getElementById('caixaSaldoValor');
        elSaldo.textContent = formatarMoeda(data.saldo);

        // Cor do saldo
        if (data.saldo < 0) {
            elSaldo.style.color = '#EF4444'; // Vermelho
        } else {
            elSaldo.style.color = '#059669'; // Verde
        }
    } catch (error) {
        console.error('Erro ao carregar saldo:', error);
        mostrarNotificacao('Erro ao atualizar saldo', 'erro');
    }
}

async function carregarCaixaExtrato() {
    try {
        const response = await fetchComAuth('/api/caixa/extrato?limit=50');
        if (!response.ok) throw new Error('Erro ao carregar extrato');

        const extrato = await response.json();
        const tbody = document.getElementById('caixaExtratoLista');
        tbody.innerHTML = '';

        if (extrato.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Nenhuma movimentação recente</td></tr>';
            return;
        }

        extrato.forEach(item => {
            const tr = document.createElement('tr');

            // Data
            const data = new Date(item.criado_em);
            const dataFmt = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Valor Class
            const isPositivo = item.valor >= 0;
            const valorClass = isPositivo ? 'valor-positivo' : 'valor-negativo';
            const catClass = getCategoriaClass(item.categoria);

            tr.innerHTML = `
                <td>${dataFmt}</td>
                <td>${item.descricao}</td>
                <td><span class="badge ${catClass}">${formatarCategoria(item.categoria)}</span></td>
                <td class="${valorClass}">${formatarMoeda(item.valor)}</td>
                <td style="font-size: 0.85rem; color: #666;">${item.usuario_nome || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erro ao carregar extrato:', error);
    }
}

function formatarCategoria(cat) {
    const map = {
        'manual': 'Manual',
        'agendamento': 'Agenda',
        'sangria': 'Fechamento'
    };
    return map[cat] || cat;
}

function getCategoriaClass(cat) {
    if (cat === 'agendamento') return 'badge-blue';
    if (cat === 'sangria') return 'badge-red';
    return 'badge-gray'; // manual
}

// --- Transações Manuais ---

function abrirModalTransacao(tipo) {
    caixaTransacaoTipo = tipo;
    const miniModal = document.getElementById('modalNovaTransacaoCaixa');
    const title = document.getElementById('modalTransacaoTitle');

    // Limpar campos
    document.getElementById('transacaoValor').value = '';
    document.getElementById('transacaoDescricao').value = '';

    if (tipo === 'entrada') {
        title.textContent = 'Adicionar Dinheiro ➕';
        title.style.color = '#059669';
    } else {
        title.textContent = 'Retirar Dinheiro ➖';
        title.style.color = '#EF4444';
    }

    miniModal.style.display = 'flex';
    document.getElementById('transacaoValor').focus();
}

function fecharModalTransacao() {
    document.getElementById('modalNovaTransacaoCaixa').style.display = 'none';
}

async function salvarTransacaoCaixa() {
    const valorInput = document.getElementById('transacaoValor').value;
    const descricao = document.getElementById('transacaoDescricao').value;

    if (!valorInput || !descricao) {
        mostrarNotificacao('Preencha valor e descrição', 'erro');
        return;
    }

    let valor = parseFloat(valorInput);
    if (caixaTransacaoTipo === 'saida') {
        valor = -Math.abs(valor); // Garantir negativo
    } else {
        valor = Math.abs(valor); // Garantir positivo
    }

    try {
        const response = await fetchComAuth('/api/caixa/transacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                valor,
                descricao
            })
        });

        if (!response.ok) throw new Error('Erro ao salvar transação');

        mostrarNotificacao('Transação realizada com sucesso', 'sucesso');
        fecharModalTransacao();

        // Recarregar dados
        carregarCaixaSaldo();
        carregarCaixaExtrato();
    } catch (error) {
        console.error(error);
        mostrarNotificacao('Erro ao salvar transação', 'erro');
    }
}

async function confirmarZerarCaixa() {
    if (!confirm('ATENÇÃO: Isso irá criar uma saída (sangria) no valor total do saldo para zerar o caixa.\n\nDeseja realizar o Fechamento de Caixa?')) {
        return;
    }

    try {
        const response = await fetchComAuth('/api/caixa/zerar', {
            method: 'POST'
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Erro ao zerar caixa');

        if (data.message) {
            mostrarNotificacao(data.message, 'aviso');
        } else {
            mostrarNotificacao(`Caixa zerado! Retirada de ${formatarMoeda(data.valor_retirado)}`, 'sucesso');
        }

        carregarCaixaSaldo();
        carregarCaixaExtrato();

    } catch (error) {
        console.error(error);
        mostrarNotificacao('Erro ao zerar caixa: ' + error.message, 'erro');
    }
}

async function confirmarLimparHistorico() {
    // Confirmação dupla por segurança
    if (!confirm('PERIGO: Tem certeza que deseja APAGAR TODO O HISTÓRICO de transações do caixa?\n\nEssa ação é irreversível e o saldo pode ficar inconsistente se não for feito o fechamento antes.')) {
        return;
    }

    if (!confirm('Confirmação final: APAGAR TUDO?')) {
        return;
    }

    try {
        const response = await fetchComAuth('/api/caixa/transacoes', {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Erro ao limpar histórico');

        mostrarNotificacao('Histórico apagado com sucesso!', 'sucesso');

        carregarCaixaSaldo();
        carregarCaixaExtrato();

    } catch (error) {
        console.error(error);
        mostrarNotificacao('Erro: ' + error.message, 'erro');
    }
}
