// dashboard_gestao_reservas.js

export async function abrirGestaoResponsavel() {
    document.getElementById('calendar-container').style.display = 'none';
    document.getElementById('painelGestao').style.display = 'block';

    const res = await fetch('/api/admin/monitorar-reservas');
    const reservas = await res.json();
    const corpoTabela = document.getElementById('tabelaMonitoramento');

    corpoTabela.innerHTML = reservas.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px; font-weight: bold;">${r.equipment.name}</td>
            <td style="padding: 12px;">${r.user.full_name || 'Usuário Externo'}</td>
            <td style="padding: 12px;">${new Date(r.start_time).toLocaleString('pt-BR')}</td>
            <td style="padding: 12px;">${new Date(r.end_time).toLocaleString('pt-BR')}</td>
            <td style="padding: 12px; color: #3498db;">${r.user.username}</td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="cancelarReservaAdmin(${r.id})" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                    Remover Reserva
                </button>
            </td>
        </tr>
    `).join('');
}

export async function cancelarReservaAdmin(id) {
    if (!confirm("Deseja remover este agendamento do sistema?")) return;

    const res = await fetch(`/api/admin/cancelar-reserva/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert("Reserva removida.");
        abrirGestaoResponsavel(); 
    }
}

// Expõe a função de deletar para o botão gerado na tabela
window.cancelarReservaAdmin = cancelarReservaAdmin;