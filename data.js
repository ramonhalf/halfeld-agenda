// Configurações da API - Dinâmica para funcionar local e remoto
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;

// Configurações de horário
const HORARIO_INICIO = 8; // 8:00
const HORARIO_FIM = 18; // 18:00
const INTERVALO_MINUTOS = 30;

// Cores das categorias
const CORES_CATEGORIAS = {
    'Banhos': '#4F46E5',
    'Tosa Comercial': '#7C3AED',
    'Tosa Avançada': '#9333EA',
    'Tosa Específica': '#A855F7',
    'Cuidados Adicionais': '#C084FC',
    'Cuidados Especiais': '#D8B4FE',
    'Taxi Dog': '#F59E0B'
};

// Utilitários de data/hora
function formatarData(data) {
    if (!data) return '';
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatarHora(hora) {
    return hora.substring(0, 5);
}

function obterDataHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function adicionarDias(data, dias) {
    const d = new Date(data + 'T00:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
}

function calcularDuracao(servicos) {
    if (!servicos || servicos.length === 0) return 60;

    let duracaoTotal = 0;
    servicos.forEach(serv => {
        duracaoTotal += serv.duracao_minutos || 60;
    });
    return duracaoTotal;
}

function gerarHorarios() {
    const horarios = [];
    for (let hora = HORARIO_INICIO; hora < HORARIO_FIM; hora++) {
        for (let minuto = 0; minuto < 60; minuto += INTERVALO_MINUTOS) {
            const horaStr = String(hora).padStart(2, '0');
            const minutoStr = String(minuto).padStart(2, '0');
            horarios.push(`${horaStr}:${minutoStr}`);
        }
    }
    return horarios;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Validação de conflitos de horário
function verificarConflito(agendamentos, novoAgendamento) {
    const [novaHora, novoMinuto] = novoAgendamento.hora_inicio.split(':').map(Number);
    const novoInicio = novaHora * 60 + novoMinuto;
    const novoFim = novoInicio + novoAgendamento.duracao_minutos;

    for (let agend of agendamentos) {
        if (agend.data !== novoAgendamento.data) continue;
        if (agend.id === novoAgendamento.id) continue; // Ignorar o próprio agendamento ao editar

        const [hora, minuto] = agend.hora_inicio.split(':').map(Number);
        const inicio = hora * 60 + minuto;
        const fim = inicio + agend.duracao_minutos;

        // Verifica sobreposição
        if ((novoInicio < fim) && (novoFim > inicio)) {
            return {
                conflito: true,
                agendamento: agend
            };
        }
    }

    return { conflito: false };
}

// Notificações
function mostrarNotificacao(mensagem, tipo = 'info', duracao = 3000) {
    const container = document.getElementById('notifications');
    const notif = document.createElement('div');
    notif.className = `notification ${tipo}`;
    notif.innerHTML = `
        <span>${mensagem}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">×</button>
    `;

    container.appendChild(notif);

    if (duracao > 0) {
        setTimeout(() => {
            notif.remove();
        }, duracao);
    }
}

// Alarmes para Taxi Dog
function verificarAlarmes(agendamentos) {
    const agora = new Date();
    const dataHoje = obterDataHoje();
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();
    const minutosAtual = horaAtual * 60 + minutoAtual;

    agendamentos.forEach(agend => {
        if (agend.data !== dataHoje) return;

        const [hora, minuto] = agend.hora_inicio.split(':').map(Number);
        const minutosAgendamento = hora * 60 + minuto;
        const diferencaMinutos = minutosAgendamento - minutosAtual;

        // Alarme 15 minutos antes para buscar
        if (agend.taxi_buscar && diferencaMinutos === 15) {
            mostrarNotificacao(
                `🚗 Taxi Dog - Buscar ${agend.pet_nome} em 15 minutos! (${formatarHora(agend.hora_inicio)})`,
                'alarm',
                0 // Não auto-fechar
            );
            playAlarmSound();
        }

        // Alarme 15 minutos antes do fim para levar
        if (agend.taxi_levar) {
            const fimAgendamento = minutosAgendamento + agend.duracao_minutos;
            const diferencaFim = fimAgendamento - minutosAtual;

            if (diferencaFim === 15) {
                mostrarNotificacao(
                    `🚗 Taxi Dog - Levar ${agend.pet_nome} em 15 minutos!`,
                    'alarm',
                    0
                );
                playAlarmSound();
            }
        }
    });
}

function playAlarmSound() {
    // Som de alarme usando Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}
