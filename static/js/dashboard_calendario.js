// dashboard_calendario.js

// Variáveis locais de estado do calendário
let currentCalendar = null;
let agendamentoEmEdicao = null;

// Função auxiliar para pegar o ID localmente no módulo
const getUserId = () => localStorage.getItem('user_id');

export function inicializarCalendario(id) {
    const calendarEl = document.getElementById('calendar');
    if (currentCalendar) currentCalendar.destroy();

    currentCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'pt-br',
        events: `/api/eventos/${id}?user_id=${getUserId()}`,
        selectable: true,
        select: function (info) {
            agendamentoEmEdicao = null; // Novo agendamento
            abrirModal(info.startStr.slice(0, 16), info.endStr.slice(0, 16));
        },
        eventClick: function (info) {
            // Edição de bloco existente
            agendamentoEmEdicao = info.event.id;
            abrirModal(
                info.event.startStr.slice(0, 16),
                info.event.endStr.slice(0, 16),
                true,
                info.event.id
            );
        }
    });
    currentCalendar.render();
}

export function abrirModal(inicio, fim, ehEdicao = false, scheduleId = null) {
    document.getElementById('startTime').value = inicio;
    document.getElementById('endTime').value = fim;
    document.getElementById('modalForm').style.display = 'block';

    const btnExcluir = document.getElementById('btnExcluir');
    const btnConfirmar = document.getElementById('btnConfirmar');
    const inputEditId = document.getElementById('editScheduleId');

    if (ehEdicao) {
        if (inputEditId) inputEditId.value = scheduleId;
        agendamentoEmEdicao = scheduleId;
        if (btnExcluir) btnExcluir.style.display = 'block';
        if (btnConfirmar) btnConfirmar.innerText = "Salvar Alterações";
        document.querySelector('#modalForm h3').innerText = "Editar/Excluir Agendamento";
    } else {
        if (inputEditId) inputEditId.value = "";
        agendamentoEmEdicao = null;
        if (btnExcluir) btnExcluir.style.display = 'none';
        if (btnConfirmar) btnConfirmar.innerText = "Confirmar Agendamento";
        document.querySelector('#modalForm h3').innerText = "Novo Agendamento";
    }
}

export function fecharModal() {
    const modal = document.getElementById('modalForm');
    if (modal) modal.style.display = 'none';
    
    const form = document.getElementById('agendamentoForm');
    if (form) form.reset();
    
    const editId = document.getElementById('editScheduleId');
    if (editId) editId.value = "";
}

export async function salvarAgendamento(e) {
    e.preventDefault(); // Impede a página de recarregar no submit

    const eqId = document.getElementById('eqId').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const userId = getUserId();

    const ehEdicao = agendamentoEmEdicao !== null && agendamentoEmEdicao !== ""; 

    let url = '/api/agendar';
    let metodo = 'POST';
    let payload = {
        equipment_id: parseInt(eqId),
        user_id: parseInt(userId),
        start_time: startTime,
        end_time: endTime
    };

    if (ehEdicao) {
        url = `/api/agendamento/${agendamentoEmEdicao}?user_id=${userId}`;
        metodo = 'PUT';
        payload = {
            start_time: startTime,
            end_time: endTime
        };
    }

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(ehEdicao ? "Agendamento atualizado com sucesso!" : "Agendamento realizado!");
            fecharModal();
            if (currentCalendar) currentCalendar.refetchEvents();
        } else {
            const erro = await res.json();
            alert(erro.detail || "Erro ao salvar agendamento.");
        }
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        alert("Erro de conexão.");
    }
}

export async function excluirAgendamento() {
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    try {
        const res = await fetch(`/api/agendamento/${agendamentoEmEdicao}?user_id=${getUserId()}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            fecharModal();
            if (currentCalendar) currentCalendar.refetchEvents();
        } else {
            const erro = await res.json();
            alert(erro.detail);
        }
    } catch (erro) {
        console.error("Erro ao excluir:", erro);
    }
}