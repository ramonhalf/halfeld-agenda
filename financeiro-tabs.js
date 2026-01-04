// ========== FINANCEIRO - CONTROLES COM SELECTS ==========

// Variável global para armazenar unidade atualmente selecionada
let unidadeFinanceiroAtual = ''; // '' = consolidado, '1' = Un.01, '2' = Un.02
let financeiroInicializado = false;
let carregandoRelatorio = false; // Flag para evitar chamadas simultâneas

// Inicializar controles do financeiro
function inicializarFinanceiroTabs() {
    if (financeiroInicializado) {
        console.log('Financeiro já inicializado, pulando...');
        return;
    }

    financeiroInicializado = true;
    console.log('Inicializando sistema financeiro...');

    // Event listener para select de unidade
    const selectUnidade = document.getElementById('financeiroUnidade');
    if (selectUnidade) {
        selectUnidade.addEventListener('change', function () {
            if (carregandoRelatorio) return;

            unidadeFinanceiroAtual = this.value;
            console.log(`📊 Unidade alterada para: ${unidadeFinanceiroAtual || 'Consolidado'}`);
            carregarRelatorioFinanceiroComUnidade();
        });
    }

    // Event listener para select de tipo (diário/mensal/anual)
    const selectTipo = document.getElementById('financeiroTipo');
    if (selectTipo) {
        selectTipo.addEventListener('change', function () {
            const tipo = this.value;
            const isDiario = tipo === 'diario';
            const isMensal = tipo === 'mensal';
            const isAnual = tipo === 'anual';

            // Alternar visibilidade dos campos de data
            const dataInput = document.getElementById('financeiroData');
            const mesInput = document.getElementById('financeiroMes');
            const anoInput = document.getElementById('financeiroAno');
            const anoAnualInput = document.getElementById('financeiroAnoAnual');
            const btnPrev = document.getElementById('btnFinanceiroPrevDay');
            const btnNext = document.getElementById('btnFinanceiroNextDay');
            const btnToday = document.getElementById('btnFinanceiroToday');
            const exportBtn = document.getElementById('exportButtonContainer');

            // Campos para Diário
            if (dataInput) dataInput.style.display = isDiario ? 'inline-block' : 'none';
            if (btnPrev) btnPrev.style.display = isDiario ? 'inline-block' : 'none';
            if (btnNext) btnNext.style.display = isDiario ? 'inline-block' : 'none';
            if (btnToday) btnToday.style.display = isDiario ? 'inline-block' : 'none';

            // Campos para Mensal
            if (mesInput) mesInput.style.display = isMensal ? 'inline-block' : 'none';
            if (anoInput) anoInput.style.display = isMensal ? 'inline-block' : 'none';

            // Campo para Anual
            if (anoAnualInput) {
                anoAnualInput.style.display = isAnual ? 'inline-block' : 'none';
                // Definir ano atual se estiver vazio
                if (isAnual && !anoAnualInput.value) {
                    anoAnualInput.value = new Date().getFullYear();
                }
            }

            // Mostrar botão de exportar apenas para Mensal e Anual
            if (exportBtn) {
                exportBtn.style.display = (isMensal || isAnual) ? 'block' : 'none';
            }

            console.log(`📅 Tipo alterado para: ${tipo}`);

            setTimeout(() => {
                carregarRelatorioFinanceiroComUnidade();
            }, 50);
        });
    }

    // Event listeners para navegação de data
    const btnPrevDay = document.getElementById('btnFinanceiroPrevDay');
    const btnNextDay = document.getElementById('btnFinanceiroNextDay');
    const btnToday = document.getElementById('btnFinanceiroToday');

    if (btnPrevDay) {
        btnPrevDay.addEventListener('click', () => {
            const input = document.getElementById('financeiroData');
            const dataAtual = new Date(input.value + 'T12:00:00');
            dataAtual.setDate(dataAtual.getDate() - 1);
            input.value = dataAtual.toISOString().split('T')[0];
            carregarRelatorioFinanceiroComUnidade();
        });
    }

    if (btnNextDay) {
        btnNextDay.addEventListener('click', () => {
            const input = document.getElementById('financeiroData');
            const dataAtual = new Date(input.value + 'T12:00:00');
            dataAtual.setDate(dataAtual.getDate() + 1);
            input.value = dataAtual.toISOString().split('T')[0];
            carregarRelatorioFinanceiroComUnidade();
        });
    }

    if (btnToday) {
        btnToday.addEventListener('click', () => {
            document.getElementById('financeiroData').value = obterDataHoje();
            carregarRelatorioFinanceiroComUnidade();
        });
    }
}

// Função auxiliar para carregar relatório com unidade
function carregarRelatorioFinanceiroComUnidade() {
    if (carregandoRelatorio) {
        console.log('⚠️ Carregamento já em andamento, pulando requisição duplicada');
        return;
    }

    // Pegar o valor do select de tipo
    const selectTipo = document.getElementById('financeiroTipo');
    const tabAtiva = selectTipo ? selectTipo.value : 'diario';

    if (!tabAtiva) {
        console.error('Nenhuma tab ativa encontrada');
        return;
    }

    let inicio, fim;

    // Definir datas de início e fim baseadas no tab
    if (tabAtiva === 'diario') {
        const data = document.getElementById('financeiroData').value;
        if (!data) return;
        inicio = data;
        fim = data;
    } else if (tabAtiva === 'mensal') {
        const mes = document.getElementById('financeiroMes').value;
        const ano = document.getElementById('financeiroAno').value;
        if (!mes || !ano) return;

        // Primeiro e último dia do mês (com zero à esquerda)
        const mesPadded = mes.toString().padStart(2, '0');
        inicio = `${ano}-${mesPadded}-01`;
        const ultimoDia = new Date(ano, mes, 0).getDate();
        fim = `${ano}-${mesPadded}-${ultimoDia.toString().padStart(2, '0')}`;
    } else if (tabAtiva === 'anual') {
        const ano = document.getElementById('financeiroAnoAnual').value;
        if (!ano) return;
        inicio = `${ano}-01-01`;
        fim = `${ano}-12-31`;
    }

    let url = `${API_URL}/financeiro/consolidado?inicio=${inicio}&fim=${fim}`;

    // Adicionar filtro de unidade se não for consolidado
    if (unidadeFinanceiroAtual !== '') {
        url += `&unidade=${unidadeFinanceiroAtual}`;
    }

    const unidadeNome = unidadeFinanceiroAtual === '' ? 'Consolidado' : `Unidade ${unidadeFinanceiroAtual}`;
    console.log(`🔄 Carregando financeiro - ${unidadeNome}, Tab: ${tabAtiva}`);

    carregandoRelatorio = true;
    mostrarLoading(true);

    fetchComAuth(url)
        .then(response => response.json())
        .then(transacoes => {
            // Se for tab "diario" ou "mensal", usamos a função de exibir do DOM
            // Se for "anual", precisamos apenas calcular os totais
            if (typeof calcularEExibirRelatorio === 'function') {
                calcularEExibirRelatorio(transacoes, tabAtiva);
            }

            // Atualizar dataset para exportação
            const relatorioLista = document.getElementById('relatorioLista');
            if (relatorioLista) {
                relatorioLista.dataset.agendamentos = JSON.stringify(transacoes);
            }

            console.log(`✅ Financeiro carregado - ${transacoes.length} transações`);
        })
        .catch(error => {
            console.error('❌ Erro ao carregar relatório:', error);
            mostrarNotificacao('Erro ao carregar relatório financeiro!', 'error');
        })
        .finally(() => {
            mostrarLoading(false);
            carregandoRelatorio = false;
        });
}

function calcularTotaisMensal(transacoes) {
    let total = 0, pago = 0, entrada = 0, saida = 0;

    // Categorias
    let servicos = 0, pacotes = 0, produtos = 0, outros = 0;

    transacoes.forEach(t => {
        const valor = parseFloat(t.valor || 0);

        // Se valor for positivo é entrada, negativo é saída (ajustar lógica conforme seu sistema de caixa)
        // Assumindo que no caixa_transacoes:
        // Entradas: agendamento, pacote, produto, outros_entrada
        // Saídas: despesa, sangria, outros_saida

        // Por enquanto, vamos somar tudo como positivo para faturamento bruto, 
        // mas idealmente caixa deve diferenciar entrada/saída

        if (['agendamento', 'pacote', 'produto', 'suprimento'].includes(t.categoria)) {
            total += valor;
            entrada += valor;
            pago += valor; // Caixa só registra o que foi pago
        }

        if (t.categoria === 'agendamento') servicos += valor;
        else if (t.categoria === 'pacote') pacotes += valor;
        else if (t.categoria === 'produto') produtos += valor;
        else outros += valor;
    });

    return {
        total,
        pago,
        aReceber: 0, // Caixa real não tem "a receber", isso viria dos agendamentos em aberto
        taxi: 0, // Precisaria extrair do detalhe
        servicos,
        pacotes, // Novo campo
        numAgendamentos: transacoes.length, // Total de transações
        porForma: { dinheiro: 0, pix: 0, cartao: 0 } // Caixa geralmente não salva forma se não tiver coluna especifica
    };
}

// Event listener para botão de exportar
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        const btnExportar = document.getElementById('btnExportarExcel');
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarRelatorioExcel);
            console.log('✅ Botão de exportar Excel configurado');
        }
    }, 500);
});

// Função stub para exportar relatório (a ser implementada)
function exportarRelatorioExcel() {
    console.log('Função exportarRelatorioExcel ainda não implementada');
    alert('Função de exportação será implementada em breve');
}
