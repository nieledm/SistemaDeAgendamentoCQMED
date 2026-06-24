import { verificarStatusGeral, verificarStatusAcesso, verificarStatusAtivacao } from './utils.js';

// ============================================================================
// USUÁRIOS EXTERNOS
// ============================================================================
export async function carregarDadosUsuariosExternos() {
    try {
        const res = await fetch('/api/admin/usuarios-externos');
        const usuarios = await res.json();
        const tabela = document.getElementById('tabelaAdminUsuarios');
        
        tabela.innerHTML = usuarios.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td>${u.expiration_date ? new Date(u.expiration_date).toLocaleDateString('pt-BR') : 'Sem Validade Configurada'}</td>
                <td>${verificarStatusGeral(u.expiration_date, u.is_active)}</td>
                <td style="display: flex; gap: 10px;">
                    <button onclick="editarUsuarioExterno('${u.username}', '${u.expiration_date || ''}')" style="background: none; border: none; cursor: pointer; color: #2980b9; font-weight: bold;" title="Alterar Validade">✏️ Validade</button>
                    <button onclick="desativarUsuarioExterno('${u.username}')" style="background: none; border: none; cursor: pointer; color: #f39c12; font-weight: bold;" title="Forçar expiração imediatamente">🚫 Desativar</button>
                    <button onclick="excluirUsuarioExterno(${u.id})" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-weight: bold;" title="Excluir definitivamente">🗑️ Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        console.error("Erro ao carregar usuários externos:", erro);
    }
}

export async function cadastrarUsuarioExterno() {
    const email = document.getElementById('novoEmailExterno').value;
    const validade = document.getElementById('novaValidadeExterna').value;

    if (!email) return alert("Por favor, digite o e-mail do usuário.");

    const payload = {
        email: email,
        expiration_date: validade ? new Date(validade).toISOString() : null
    };

    const res = await fetch('/api/admin/usuarios-externos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Usuário externo cadastrado com sucesso!");
        document.getElementById('novoEmailExterno').value = '';
        document.getElementById('novaValidadeExterna').value = '';
        carregarDadosUsuariosExternos(); 
    } else {
        alert("Erro ao cadastrar usuário externo.");
    }
}

export async function desativarUsuarioExterno(email) {
    if (!confirm(`Deseja revogar imediatamente o acesso de ${email}?`)) return;
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    const payload = { email: email, expiration_date: ontem.toISOString() };
    const res = await fetch('/api/admin/usuarios-externos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Acesso desativado!");
        carregarDadosUsuariosExternos();
    } else {
        alert("Erro ao desativar usuário.");
    }
}

export async function excluirUsuarioExterno(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário DE FORMA PERMANENTE?")) return;
    const res = await fetch(`/api/admin/usuario-externo/${id}`, { method: 'DELETE' });

    if (res.ok) {
        alert("Usuário excluído com sucesso!");
        carregarDadosUsuariosExternos();
    } else {
        const erro = await res.json();
        alert(erro.detail || "Erro ao excluir usuário.");
    }
}

export async function editarUsuarioExterno(email, dataAtual) {
    const valorPadrao = dataAtual ? dataAtual.split('T')[0] : '';
    const novaData = prompt(`Defina a data limite de acesso para ${email}\n(Formato: AAAA-MM-DD):`, valorPadrao);
    if (!novaData) return; 

    const payload = { email: email, expiration_date: new Date(novaData).toISOString() };
    const res = await fetch('/api/admin/usuarios-externos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosExternos(); 
    } else {
        alert("Erro ao atualizar a data de validade.");
    }
}

// ============================================================================
// USUÁRIOS INTERNOS
// ============================================================================
export async function carregarDadosUsuariosInternos() {
    try {
        const res = await fetch('/api/usuarios-internos');
        const usuarios = await res.json();
        // Filtra só os ativos antes de desenhar a tabela!
        // const usuariosAtivos = usuarios.filter(u => u.is_active === true);
        const tabela = document.getElementById('tabelaAdminInternos');
        
        // tabela.innerHTML = usuariosAtivos.map(u => `
        tabela.innerHTML = usuarios.map(u => `
            <tr>
                <td><strong>${u.username}</strong> ${u.is_admin ? '<span style="font-size:0.75rem; background:#8e44ad; color:white; padding:2px 6px; border-radius:10px; margin-left:8px;">🛡️ Admin</span>' : ''}</td>
                <td>${u.expiration_date ? new Date(u.expiration_date).toLocaleDateString('pt-BR') : '<span style="color:#27ae60;">Vitalício</span>'}</td>
                <td>${verificarStatusGeral(u.expiration_date, u.is_active)}</td>
                <td style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="editarUsuarioInterno('${u.username}', '${u.expiration_date || ''}')" style="background: none; border: none; cursor: pointer; color: #2980b9; font-weight: bold;">✏️ Validade</button>
                    <button onclick="alternarAdminInterno('${u.username}', ${u.is_admin})" style="background: none; border: none; cursor: pointer; color: #8e44ad; font-weight: bold;">👑 ${u.is_admin ? 'Remover Admin' : 'Virar Admin'}</button>
                    <button onclick="alternarStatusInterno('${u.username}', ${u.is_active})" style="background: none; border: none; cursor: pointer; color: ${u.is_active ? '#e74c3c' : '#27ae60'}; font-weight: bold;">${u.is_active ? '🚫 Desativar' : '✅ Ativar'}</button>
                    <button onclick="excluirUsuarioInterno(${u.id})" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-weight: bold;">🗑️ Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        console.error("Erro ao carregar usuários internos:", erro);
    }
}

export async function editarUsuarioInterno(username, dataAtual) {
    const valorPadrao = dataAtual && dataAtual !== 'null' ? dataAtual.split('T')[0] : '';
    const novaData = prompt(`Defina a data limite de acesso para ${username}\nDeixe EM BRANCO para acesso VITALÍCIO.\n(Formato: AAAA-MM-DD):`, valorPadrao);
    if (novaData === null) return; 

    const payload = { username: username, expiration_date: novaData.trim() !== '' ? new Date(novaData).toISOString() : null };
    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) carregarDadosUsuariosInternos(); 
    else alert("Erro ao atualizar a data de validade.");
}

export async function alternarAdminInterno(username, is_admin_atual) {
    const novoStatus = !is_admin_atual;
    if (!confirm(`Deseja realmente ${novoStatus ? "CONCEDER" : "REMOVER"} privilégios de Administrador para ${username}?`)) return;

    const payload = { username: username, is_admin: novoStatus };
    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) carregarDadosUsuariosInternos();
    else alert("Erro ao alterar privilégios.");
}

export async function alternarStatusInterno(username, is_active_atual) {
    const novoStatus = !is_active_atual; 
    if (!confirm(`Deseja realmente ${novoStatus ? "ATIVAR" : "DESATIVAR"} o acesso de ${username}?`)) return;

    const payload = { username: username, is_active: novoStatus };
    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos(); 
        carregarDadosUsuariosPendentes(); // Atualiza a aba de pendentes caso esteja lá
    } else {
        alert("Erro ao alterar o status do usuário.");
    }
}

export async function excluirUsuarioInterno(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário DE FORMA PERMANENTE?")) return;
    const res = await fetch(`/api/usuarios-internos/${id}`, { method: 'DELETE' });

    if (res.ok) {
        alert("Usuário excluído com sucesso!");
        carregarDadosUsuariosInternos();
        carregarDadosUsuariosPendentes();
    } else {
        const erro = await res.json();
        alert(erro.detail || "Erro ao excluir usuário.");
    }
}

// ============================================================================
// USUÁRIOS PENDENTES
// ============================================================

export async function carregarDadosUsuariosPendentes() {
    try {
        const res = await fetch('/api/usuarios-pendentes');
        const usuarios = await res.json();
        const tabela = document.getElementById('tabelaAdminPendentes');
        
        tabela.innerHTML = usuarios.map(u => `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td>${u.email}</td>
                <td>${u.is_external ? 'Externo' : 'Interno'}</td>
                <td>${u.expiration_date ? new Date(u.expiration_date).toLocaleDateString('pt-BR') : '<span style="color:#27ae60;">Vitalício</span>'}</td>
                <td>${verificarStatusAcesso(u.expiration_date)}</td>
                <td>${verificarStatusAtivacao(u.is_active)}</td>
                <td style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="editarUsuarioInterno('${u.username}', '${u.expiration_date || ''}')" style="background: none; border: none; cursor: pointer; color: #2980b9; font-weight: bold;">✏️ Validade</button>
                    <button onclick="alternarStatusInterno('${u.username}', ${u.is_active})" style="background: none; border: none; cursor: pointer; color: ${u.is_active ? '#e74c3c' : '#27ae60'}; font-weight: bold;">${u.is_active ? '🚫 Desativar' : '✅ Ativar'}</button>
                    <button onclick="excluirUsuarioInterno(${u.id})" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-weight: bold;">🗑️ Excluir</button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        console.error("Erro ao carregar usuários pendentes:", erro);
    }
}

// Expõe as funções para os botões gerados nas strings de HTML
window.editarUsuarioExterno = editarUsuarioExterno;
window.desativarUsuarioExterno = desativarUsuarioExterno;
window.excluirUsuarioExterno = excluirUsuarioExterno;
window.editarUsuarioInterno = editarUsuarioInterno;
window.alternarAdminInterno = alternarAdminInterno;
window.alternarStatusInterno = alternarStatusInterno;
window.excluirUsuarioInterno = excluirUsuarioInterno;