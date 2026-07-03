// Importa a função que atualiza a barra lateral (vamos exportá-la no próximo passo)
import { carregarMenu } from './dashboard.js';

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: EQUIPAMENTOS
// -----------------------------------------------------------------------------
export async function carregarDadosEquipamentosAdmin() {
    try {
        const [resEq, resUsr] = await Promise.all([
            fetch('/api/admin/equipamentos'),
            fetch('/api/admin/usuarios-internos')
        ]);
        
        const equipamentos = await resEq.json();
        const usuarios = await resUsr.json();
        equipamentos.sort((a, b) => a.name.localeCompare(b.name));

        const mapaUsuarios = {};
        usuarios.forEach(u => { mapaUsuarios[u.id] = u.full_name || u.username; });

        const tabela = document.getElementById('tabelaAdminEquipamentos');
        tabela.innerHTML = equipamentos.map(eq => {
            const nomeResponsavel = eq.responsible_id ? mapaUsuarios[eq.responsible_id] : null;
            return `
            <tr>
                <td><strong>${eq.name}</strong></td>
                <td>${nomeResponsavel ? nomeResponsavel : '<span style="color:#e74c3c;">Sem responsável</span>'}</td>
                <td><span style="color: #27ae60; font-weight: bold;">Ativo</span></td>
                <td>
                    <button onclick="abrirModalEditarEquipamento(${eq.id}, '${eq.name}', ${eq.responsible_id || null})" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; margin-right: 15px;" title="Editar Equipamento">✏️</button>
                    <button onclick="removerEquipamento(${eq.id})" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Remover Equipamento">🗑️</button>
                </td>
            </tr>
            `;
        }).join('');
    } catch (erro) {
        console.error("Erro ao carregar equipamentos:", erro);
    }
}

export async function abrirModalEditarEquipamento(id, nomeAtual, idResponsavelAtual) {
    document.getElementById('eqEditId').value = id;
    document.getElementById('eqEditNome').value = nomeAtual;
    
    const res = await fetch('/api/admin/usuarios-internos');
    const usuarios = await res.json();
    
    const select = document.getElementById('eqEditResponsavel');
    select.innerHTML = '<option value="">-- Deixar sem responsável --</option>' + 
        usuarios.map(u => `<option value="${u.id}">${u.full_name || u.username}</option>`).join('');
        
    select.value = idResponsavelAtual || "";
    document.getElementById('modalEquipamento').style.display = 'block';
}

export function fecharModalEquipamento() {
    document.getElementById('modalEquipamento').style.display = 'none';
}

export async function salvarEdicaoEquipamento() {
    const id = document.getElementById('eqEditId').value;
    const nome = document.getElementById('eqEditNome').value;
    const respId = document.getElementById('eqEditResponsavel').value;
    
    if (!nome) return alert("O nome do equipamento não pode ficar vazio!");
    
    const payload = { name: nome, responsible_id: respId ? parseInt(respId) : null };
    
    const res = await fetch(`/api/admin/equipamento/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (res.ok) {
        alert("Equipamento atualizado com sucesso!");
        fecharModalEquipamento();
        carregarDadosEquipamentosAdmin();
        carregarMenu(); 
    } else {
        const erro = await res.json();
        alert("Erro ao atualizar equipamento: " + erro.detail);
    }
}

export async function abrirModalEquipamento() {
    const nome = prompt("Digite o nome do novo equipamento:");
    if (!nome) return;

    const payload = { name: nome, responsible_id: null };
    const res = await fetch('/api/admin/equipamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Equipamento cadastrado com sucesso!");
        carregarDadosEquipamentosAdmin(); 
        carregarMenu(); 
    }
}

export async function removerEquipamento(id) {
    if (!confirm("Atenção: Tem certeza que deseja excluir este equipamento definitivamente do sistema?")) return;
    
    const res = await fetch(`/api/admin/equipamento/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert("Equipamento removido!");
        carregarDadosEquipamentosAdmin();
        carregarMenu();
    }
}

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: MANUTENÇÃO
// -----------------------------------------------------------------------------
export async function carregarSelectEquipamentosManutencao() {
    try {
        const response = await fetch('/api/equipamentos');
        const equipamentos = await response.json();
        equipamentos.sort((a, b) => a.name.localeCompare(b.name));
        const select = document.getElementById('maintEquipamentoId');
        select.innerHTML = `
            <option value="">Selecione um equipamento...</option>
            <option value="0" style="font-weight: bold; color: #e74c3c;">⚠️ TODOS OS EQUIPAMENTOS</option>
        `;
        
        equipamentos.forEach(eq => {
            const option = document.createElement('option');
            option.value = eq.id;
            option.textContent = eq.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar equipamentos para o select:", error);
    }
}

// export async function salvarManutencao(event) {
//     event.preventDefault();

//     const dados = {
//         equipment_id: parseInt(document.getElementById('maintEquipamentoId').value),
//         start_time: document.getElementById('maintStartTime').value,
//         end_time: document.getElementById('maintEndTime').value,
//         description: document.getElementById('maintDescription').value,
//         create_user: parseInt(localStorage.getItem('user_id')) || 0
//     };

//     const response = await fetch('/api/admin/manutencao', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(dados)
//     });

//     if (response.ok) {
//         alert("Manutenção programada com sucesso!");
//         document.getElementById('formMaintAdmin').reset();
//         carregarTabelaManutencoes();
//         // Dispara evento global para o calendário se atualizar
//         window.dispatchEvent(new Event('atualizarCalendario'));
//     } else {
//         const resultado = await response.json();
//         alert("Erro: " + resultado.detail);
//     }
// }

export async function salvarManutencao(event) {
    event.preventDefault();

    const equipValue = document.getElementById('maintEquipamentoId').value;
    // Se for "todos" ou 0, passamos 0 para o backend
    const equipId = (equipValue === 'todos' || equipValue === '0') ? 0 : parseInt(equipValue);

    const dados = {
        equipment_id: equipId,
        start_time: document.getElementById('maintStartTime').value,
        end_time: document.getElementById('maintEndTime').value,
        description: document.getElementById('maintDescription').value,
        create_user: parseInt(localStorage.getItem('user_id')) || 0
    };

    const response = await fetch('/api/admin/manutencao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    if (response.ok) {
        const resultado = await response.json();
        alert(resultado.msg || "Manutenção programada com sucesso!");
        document.getElementById('formMaintAdmin').reset();
        carregarTabelaManutencoes();
        // Dispara evento global para o calendário se atualizar
        window.dispatchEvent(new Event('atualizarCalendario'));
    } else {
        const resultado = await response.json();
        alert("Erro: " + resultado.detail);
    }
}

export async function carregarTabelaManutencoes() {
    const tbody = document.getElementById('tabelaAdminManutencoes');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    try {
        const selectEles = document.getElementById('maintEquipamentoId');
        const equipId = selectEles ? selectEles.value : "";
        let url = '/api/admin/manutencoes/todas';
        if (equipId && equipId.trim() !== "") url += `?equipment_id=${parseInt(equipId)}`;

        const response = await fetch(url);
        const manutencoes = await response.json();

        tbody.innerHTML = '';
        if (manutencoes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma manutenção agendada.</td></tr>';
            return;
        }

        manutencoes.forEach(mt => {
            const dataInicio = new Date(mt.start_time).toLocaleString('pt-BR');
            const dataFim = new Date(mt.end_time).toLocaleString('pt-BR');
            tbody.innerHTML += `
                <tr>
                    <td><strong>${mt.equipment?.name || 'Sem Nome'}</strong></td>
                    <td>${dataInicio}</td>
                    <td>${dataFim}</td>
                    <td>${mt.description || '-'}</td>
                    <td>
                        <button class="btn-excluir" onclick="deletarManutencao(${mt.id})" style="padding: 4px 8px; font-size: 12px;">Remover</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados.</td></tr>';
    }
}

export async function deletarManutencao(id) {
    if (!confirm("Tem certeza que deseja remover esta manutenção?")) return;

    const response = await fetch(`/api/admin/manutencao/${id}`, { method: 'DELETE' });
    if (response.ok) {
        alert("Manutenção removida!");
        carregarTabelaManutencoes();
        window.dispatchEvent(new Event('atualizarCalendario'));
    } else {
        alert("Erro ao remover manutenção.");
    }
}

// Expõe para o window as funções injetadas via HTML string (tabelas dinâmicas)
window.abrirModalEditarEquipamento = abrirModalEditarEquipamento;
window.removerEquipamento = removerEquipamento;
window.deletarManutencao = deletarManutencao;