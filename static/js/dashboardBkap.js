let currentCalendar = null;
let agendamentoEmEdicao = null;
const userId = localStorage.getItem('user_id');
const userName = localStorage.getItem('user_name');
const userIsExternal = localStorage.getItem('is_external') === 'true';


document.getElementById('userNameDisplay').innerText = userName;

async function carregarMenu() {
    const res = await fetch('/api/equipamentos');
    let equipamentos = await res.json();
    const menu = document.getElementById('listaEquipamentos');
    equipamentos.sort((a, b) => a.name.localeCompare(b.name));

    menu.innerHTML = `
        <div class="equipamentos-lista">
            ${equipamentos.map(eq => `
                <button class="menu-item-btn" 
                        data-id="${eq.id}" 
                        data-name="${eq.name}" 
                        data-responsible="${eq.responsible_id || ''}"
                        onclick="cliqueEquipamento(this)">
                    ${eq.name}
                </button>
            `).join('')}
            <button id="btnAdmin" class="btn-admin" onclick="abrirGestaoAdmin()">
                🛡️ Administrador
            </button>
        </div>
    `;

    const is_admin = localStorage.getItem('is_admin') === 'true';
    if (is_admin) {
        const elementoMenu = document.getElementById('btnAdmin');
        if (elementoMenu) {
            elementoMenu.style.display = 'block';
        }
    }
}

// Nova função auxiliar para capturar o clique no botão da lista
function cliqueEquipamento(button) {
    const id = button.getAttribute('data-id');
    const nome = button.getAttribute('data-name');
    const responsibleId = button.getAttribute('data-responsible');
    
    if (id) {
        selecionarEquipamento(button, nome, id, responsibleId);
    }
}

function selecionarEquipamento(elemento, nome, id, responsibleId) {
    // Remove a classe 'active' de todos os botões e adiciona no clicado
    document.querySelectorAll('.menu-item-btn').forEach(i => i.classList.remove('active'));
    if (elemento) elemento.classList.add('active');

    const userId = localStorage.getItem('user_id');
    const is_admin = localStorage.getItem('is_admin') === 'true';

    const ehResponsavel = userId && responsibleId && String(userId) === String(responsibleId);
    const ehAdmin = is_admin === true;

    let badge = "";

    if (ehResponsavel) {
        badge = `<span style="font-size: 0.85rem; background: #2980b9; color: white; padding: 3px 8px; border-radius: 12px; margin-left: 10px; font-weight: bold; vertical-align: middle;">🛡️ Responsável</span>`;
    } else if (ehAdmin) {
        badge = `<span style="font-size: 0.85rem; background: #8e44ad; color: white; padding: 3px 8px; border-radius: 12px; margin-left: 10px; font-weight: bold; vertical-align: middle;">🛡️ Admin</span>`;
    }

    document.getElementById('tituloEquipamento').innerHTML = `${nome} ${badge}`;
    document.getElementById('eqId').value = id;
    inicializarCalendario(id);
}

function dropdownAlterado(select) {
    const id = select.value;
    const nome = select.options[select.selectedIndex].getAttribute('data-name');
    const responsibleId = select.options[select.selectedIndex].getAttribute('data-responsible');
    if (id) {
        selecionarEquipamento(select, nome, id, responsibleId);
    }
}

function inicializarCalendario(id) {
    const calendarEl = document.getElementById('calendar');
    if (currentCalendar) currentCalendar.destroy();

    currentCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        locale: 'pt-br',
        events: `/api/eventos/${id}?user_id=${userId}`,
        selectable: true,
        select: function (info) {
            agendamentoEmEdicao = null; // Novo agendamento
            abrirModal(info.startStr.slice(0, 16), info.endStr.slice(0, 16));
        },
        eventClick: function (info) {
            // Ao clicar num bloquinho existente:
            agendamentoEmEdicao = info.event.id;
            abrirModal(
                info.event.startStr.slice(0, 16),
                info.event.endStr.slice(0, 16),
                true, // flag de edição
                info.event.id
            );
        }
    });
    currentCalendar.render();
}

function abrirModal(inicio, fim, ehEdicao = false, scheduleId = null) {
    document.getElementById('startTime').value = inicio;
    document.getElementById('endTime').value = fim;
    document.getElementById('modalForm').style.display = 'block';

    const btnExcluir = document.getElementById('btnExcluir');
    const btnConfirmar = document.getElementById('btnConfirmar');
    const inputEditId = document.getElementById('editScheduleId');

    if (ehEdicao) {
        if (inputEditId) inputEditId.value = scheduleId; // Alinha com o campo do HTML
        agendamentoEmEdicao = scheduleId; // Garante que a variável do topo está preenchida
        btnExcluir.style.display = 'block';
        if (btnConfirmar) btnConfirmar.innerText = "Salvar Alterações";
        document.querySelector('#modalForm h3').innerText = "Editar/Excluir Agendamento";
    } else {
        if (inputEditId) inputEditId.value = "";
        agendamentoEmEdicao = null; // Limpa para não confundir
        btnExcluir.style.display = 'none';
        if (btnConfirmar) btnConfirmar.innerText = "Confirmar Agendamento";
        document.querySelector('#modalForm h3').innerText = "Novo Agendamento";
    }
}

function fecharModal() {
    document.getElementById('modalForm').style.display = 'none';
    document.getElementById('agendamentoForm').reset();
    document.getElementById('editScheduleId').value = ""; // Limpa o ID de edição
}

document.getElementById('agendamentoForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const eqId = document.getElementById('eqId').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const userId = localStorage.getItem('user_id');

    // CORREÇÃO: Usamos a variável exata do topo do arquivo
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
});

async function excluirAgendamento() {
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    const userId = localStorage.getItem('user_id');
    const res = await fetch(`/api/agendamento/${agendamentoEmEdicao}?user_id=${userId}`, {
        method: 'DELETE'
    });

    if (res.ok) {
        fecharModal();
        currentCalendar.refetchEvents();
    } else {
        const erro = await res.json();
        alert(erro.detail);
    }
}

async function abrirGestaoResponsavel() {
    document.getElementById('calendar-container').style.display = 'none';
    document.getElementById('painelGestao').style.display = 'block';
    
    // Mudamos para a rota de monitoramento de agendamentos reais
    const res = await fetch('/api/admin/monitorar-reservas');
    const reservas = await res.json();
    const corpoTabela = document.getElementById('tabelaMonitoramento');
    
    // Cabeçalhos sugeridos: Equipamento | Usuário | Início | Fim | Contato | Ações
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

async function cancelarReservaAdmin(id) {
    if (!confirm("Deseja remover este agendamento do sistema?")) return;
    
    const res = await fetch(`/api/admin/cancelar-reserva/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert("Reserva removida.");
        abrirGestaoResponsavel(); // Recarrega a lista
    }
}

function voltarAoCalendario() {
    document.getElementById('painelGestao').style.display = 'none';
    document.getElementById('calendar-container').style.display = 'block';
}

// --- MODAL DE AJUDA E CRÉDITOS ---
function abrirModalAjuda() {
    document.getElementById('modalAjuda').style.display = 'block';
}

function fecharModalAjuda() {
    document.getElementById('modalAjuda').style.display = 'none';
}

// #################################################################################
// PAINEL DE ADMNISTRAÇÃO - VISÃO GERAL DE USUÁRIOS E EQUIPAMENTOS
// #################################################################################

function abrirGestaoAdmin() {
    document.getElementById('calendar-container').style.display = 'none';
    
    // Trava de segurança: só esconde se o elemento existir no HTML
    const painelGestao = document.getElementById('painelGestao');
    if (painelGestao) painelGestao.style.display = 'none';
    
    document.getElementById('painelAdmin').style.display = 'flex';
    document.getElementById('botoesPainelAdmin').style.display = 'block';
    
    carregarDadosEquipamentosAdmin();
    carregarDadosUsuariosExternos();
}

function mudarAbaAdmin(aba) {
    // 1. Esconde todas as abas COM SEGURANÇA (Verifica se elas existem no HTML primeiro)
    const idAbas = ['abaEquipamentos', 'abaUsuarios', 'abaInternos', 'abaPendentes', 'abaManutencao'];
    idAbas.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = 'none'; // Só esconde se o elemento existir
    });

    // 2. Remove destaque de todos os botões e destaca apenas o clicado
    document.querySelectorAll('.btn-tab').forEach(el => el.classList.remove('active'));
    if (event && event.target && event.target.classList.contains('btn-tab')) {
        event.target.classList.add('active'); 
    }

    const painelAdmin = document.getElementById('painelAdmin');

    // 3. Mostra a aba correta e chama a função para buscar os dados
    if (aba === 'equipamentos') {
        document.getElementById('abaEquipamentos').style.display = 'block';
        carregarDadosEquipamentosAdmin(); 
        
    } else if (aba === 'usuarios') {
        document.getElementById('abaUsuarios').style.display = 'block';
        carregarDadosUsuariosExternos();
        
    } else if (aba === 'internos') {
        const abaEl = document.getElementById('abaInternos');
        if (abaEl) { // Verificação de segurança
            abaEl.style.display = 'block';
            carregarDadosUsuariosInternos();
        }
    } else if (aba === 'pendentes') {
        const abaEl = document.getElementById('abaPendentes');
        if (abaEl) { // Verificação de segurança
            abaEl.style.display = 'block';
            carregarDadosUsuariosPendentes();
        }
    } else if (aba === 'manutencao') {
        document.getElementById('abaManutencao').style.display = 'block';
        painelAdmin.style.height = (window.innerHeight - 70) + 'px';
        painelAdmin.style.overflowY = 'scroll';
        carregarSelectEquipamentosManutencao();
        carregarTabelaManutencoes();
    }
}

function voltarAoCalendario() {
    const painelGestao = document.getElementById('painelGestao');
    if (painelGestao) painelGestao.style.display = 'none';
    
    const painelAdmin = document.getElementById('painelAdmin');
    if (painelAdmin) painelAdmin.style.display = 'none';

    const botoesPainelAdmin = document.getElementById('botoesPainelAdmin');
    if (botoesPainelAdmin) botoesPainelAdmin.style.display = 'none';
    
    document.getElementById('calendar-container').style.display = 'block';
}

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: EQUIPAMENTOS
// -----------------------------------------------------------------------------

async function carregarDadosEquipamentosAdmin() {
    try {
        // Busca os equipamentos e a lista de usuários internos simultaneamente
        const [resEq, resUsr] = await Promise.all([
            fetch('/api/admin/equipamentos'),
            fetch('/api/admin/usuarios-internos')
        ]);
        
        const equipamentos = await resEq.json();
        const usuarios = await resUsr.json();
        equipamentos.sort((a, b) => a.name.localeCompare(b.name));

        // Cria um "dicionário" para achar o nome do usuário pelo ID rapidamente
        const mapaUsuarios = {};
        usuarios.forEach(u => {
            mapaUsuarios[u.id] = u.full_name || u.username;
        });

        const tabela = document.getElementById('tabelaAdminEquipamentos');
        
        // Monta a tabela cruzando o ID com o nome salvo no mapa
        tabela.innerHTML = equipamentos.map(eq => {
            // Tenta pegar o nome no dicionário. Se não achar ou não tiver ID, fica nulo.
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

// Abre a janela de edição e carrega a lista de usuários internos
async function abrirModalEditarEquipamento(id, nomeAtual, idResponsavelAtual) {
    document.getElementById('eqEditId').value = id;
    document.getElementById('eqEditNome').value = nomeAtual;
    
    // Busca os usuários no banco de dados para popular o Dropdown
    const res = await fetch('/api/admin/usuarios-internos');
    const usuarios = await res.json();
    
    const select = document.getElementById('eqEditResponsavel');
    select.innerHTML = '<option value="">-- Deixar sem responsável --</option>' + 
        usuarios.map(u => `<option value="${u.id}">${u.full_name || u.username}</option>`).join('');
        
    // Se o equipamento já tem responsável, deixa ele selecionado
    if (idResponsavelAtual) {
        select.value = idResponsavelAtual;
    } else {
        select.value = "";
    }
    
    document.getElementById('modalEquipamento').style.display = 'block';
}

function fecharModalEquipamento() {
    document.getElementById('modalEquipamento').style.display = 'none';
}

async function salvarEdicaoEquipamento() {
    const id = document.getElementById('eqEditId').value;
    const nome = document.getElementById('eqEditNome').value;
    const respId = document.getElementById('eqEditResponsavel').value;
    
    if (!nome) {
        alert("O nome do equipamento não pode ficar vazio!");
        return;
    }
    
    const payload = {
        name: nome,
        responsible_id: respId ? parseInt(respId) : null
    };
    
    // Dispara a requisição PUT para salvar
    const res = await fetch(`/api/admin/equipamento/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (res.ok) {
        alert("Equipamento atualizado com sucesso!");
        fecharModalEquipamento();
        carregarDadosEquipamentosAdmin(); // Atualiza a tabela do painel
        carregarMenu(); // Atualiza a barra lateral com o novo nome
    } else {
        const erro = await res.json();
        alert("Erro ao atualizar equipamento: " + erro.detail);
    }
}

async function abrirModalEquipamento() {
    // Usamos um prompt simples para agilizar o cadastro sem precisar criar mais HTML
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
        carregarDadosEquipamentosAdmin(); // Atualiza a tabela
        carregarMenu(); // Atualiza a barra lateral
    }
}

async function removerEquipamento(id) {
    if (!confirm("Atenção: Tem certeza que deseja excluir este equipamento definitivamente do sistema?")) return;
    
    const res = await fetch(`/api/admin/equipamento/${id}`, { method: 'DELETE' });
    if (res.ok) {
        alert("Equipamento removido!");
        carregarDadosEquipamentosAdmin();
        carregarMenu();
    }
}

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: USUÁRIOS EXTERNOS
// -----------------------------------------------------------------------------

async function carregarDadosUsuariosExternos() {
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
                    <button onclick="editarUsuarioExterno('${u.username}', '${u.expiration_date || ''}')" style="background: none; border: none; cursor: pointer; color: #2980b9; font-weight: bold;" title="Alterar Validade">
                        ✏️ Validade
                    </button>
                    
                    <button onclick="desativarUsuarioExterno('${u.username}')" style="background: none; border: none; cursor: pointer; color: #f39c12; font-weight: bold;" title="Forçar expiração imediatamente">
                        🚫 Desativar
                    </button>
                    
                    <button onclick="excluirUsuarioExterno(${u.id})" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-weight: bold;" title="Excluir definitivamente do banco">
                        🗑️ Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
    }
}

async function cadastrarUsuarioExterno() {
    const email = document.getElementById('novoEmailExterno').value;
    const validade = document.getElementById('novaValidadeExterna').value;

    if (!email) {
        alert("Por favor, digite o e-mail do usuário.");
        return;
    }

    const payload = {
        email: email,
        // Se a data foi preenchida, converte para ISO, senão manda null
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
        carregarDadosUsuariosExternos(); // Atualiza a tabela
    } else {
        alert("Erro ao cadastrar usuário externo.");
    }
}

async function desativarUsuarioExterno(email) {
    if (!confirm(`Deseja revogar imediatamente o acesso de ${email}?`)) return;

    // Define a validade para ontem para "Expirar" o acesso no mesmo momento
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    const payload = {
        email: email,
        expiration_date: ontem.toISOString()
    };

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

async function excluirUsuarioExterno(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário DE FORMA PERMANENTE do banco de dados?")) return;

    const res = await fetch(`/api/admin/usuario-externo/${id}`, {
        method: 'DELETE'
    });

    if (res.ok) {
        alert("Usuário excluído com sucesso!");
        carregarDadosUsuariosExternos();
    } else {
        const erro = await res.json();
        alert(erro.detail || "Erro ao excluir usuário.");
    }
}

// function verificarValidade(data) {
//     if (!data) return '<span style="color: #e67e22; font-weight: bold;">Pendente</span>';
    
//     const hoje = new Date();
//     const exp = new Date(data);
//     return exp < hoje 
//         ? '<span style="color: #e74c3c; font-weight: bold;">Expirado</span>' 
//         : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
// }

async function editarUsuarioExterno(email, dataAtual) {
    // Facilita o preenchimento convertendo a data existente
    const valorPadrao = dataAtual ? dataAtual.split('T')[0] : '';
    const novaData = prompt(`Defina a data limite de acesso para ${email}\n(Formato: AAAA-MM-DD):`, valorPadrao);
    
    if (!novaData) return; // Se o admin cancelar o prompt

    // Monta o payload exatamente como o UsuarioExternoConfig do FastAPI exige
    const payload = {
        email: email,
        expiration_date: new Date(novaData).toISOString()
    };

    const res = await fetch('/api/admin/usuarios-externos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Validade atualizada com sucesso!");
        carregarDadosUsuariosExternos(); // Recarrega a tabela imediatamente
    } else {
        alert("Erro ao atualizar a data de validade.");
    }
}


// -----------------------------------------------------------------------------
// FUNÇÕES DE VERIFICAÇÃO
// -----------------------------------------------------------------------------

function verificarValidade(data, is_active) {
    if (is_active === false) return '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
    if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
    const hoje = new Date();
    const exp = new Date(data);
    return exp < hoje 
        ? '<span style="color: #e74c3c; font-weight: bold;">Expirado</span>' 
        : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
}

// Checa apenas o Calendário (O prazo venceu?)
function verificarStatusAcesso(data) {
    if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
    const hoje = new Date();
    const exp = new Date(data);
    return exp < hoje 
        ? '<span style="color: #e74c3c; font-weight: bold;">Expirado</span>' 
        : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
}

// Checa apenas o Disjuntor da Conta (A conta está bloqueada no banco?)
function verificarStatusAtivacao(is_active) {
    return is_active === true
        ? '<span style="color: #27ae60; font-weight: bold;">Ativo</span>'
        : '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
}

// Combina os dois para tabelas mais simples (Ex: Aba Externos)
function verificarStatusGeral(data, is_active) {
    if (is_active === false) return '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
    if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
    const hoje = new Date();
    const exp = new Date(data);
    return exp < hoje 
        ? '<span style="color: #f39c12; font-weight: bold;">Expirado</span>' 
        : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
}

// Função que valida a sessão antes de carregar qualquer coisa
async function verificarSessao() {
    const userId = localStorage.getItem('user_id');

    // 1. Usuário não logado (sem ID no localStorage)
    if (!userId) {
        window.location.replace('/'); // Redireciona imediatamente
        return false;
    }

    // 2. Verifica no backend o status atual do usuário no banco
    try {
        const res = await fetch(`/api/verificar-acesso/${userId}`);
        
        if (!res.ok) {
            const erro = await res.json();
            alert(erro.detail || "Acesso negado.");
            localStorage.clear(); // Destrói a sessão local
            window.location.replace('/'); // Redireciona
            return false;
        }
        
        return true; // Sessão válida e status OK
    } catch (error) {
        console.error("Erro de conexão ao validar sessão:", error);
        localStorage.clear();
        window.location.replace('/');
        return false;
    }
}

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: MANUTENÇÃO
// -----------------------------------------------------------------------------

async function carregarSelectEquipamentosManutencao() {
    try {
        const response = await fetch('/api/equipamentos');
        const equipamentos = await response.json();
        equipamentos.sort((a, b) => a.name.localeCompare(b.name));
        const select = document.getElementById('maintEquipamentoId');
        select.innerHTML = '<option value="">Selecione um equipamento...</option>';
        
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

async function salvarManutencao(event) {
    event.preventDefault();

    const dados = {
        equipment_id: parseInt(document.getElementById('maintEquipamentoId').value),
        start_time: document.getElementById('maintStartTime').value,
        end_time: document.getElementById('maintEndTime').value,
        description: document.getElementById('maintDescription').value,
        create_user: parseInt(localStorage.getItem('user_id')) || 0
    };

    try {
        const response = await fetch('/api/admin/manutencao', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        if (response.ok) {
            alert(resultado.msg || "Manutenção programada com sucesso!");
            document.getElementById('formMaintAdmin').reset();
            
            // Recarrega a tabela de manutenções e atualiza o calendário em segundo plano
            carregarTabelaManutencoes();
            if (typeof calendar !== 'undefined' && calendar && typeof calendar.refetchEvents === 'function') {
                calendar.refetchEvents();
            } else {
                console.warn("Calendário não estava pronto para atualizar as manutenções.");
            }
        } else {
            alert("Erro: " + resultado.detail);
        }
    } catch (error) {
        console.error("Erro ao salvar manutenção:", error);
        alert("Erro ao conectar com o servidor.");
    }
}

async function carregarTabelaManutencoes() {
    const tbody = document.getElementById('tabelaAdminManutencoes');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    try {
        const selectEles = document.getElementById('maintEquipamentoId');
        const equipId = selectEles ? selectEles.value : "";
        
        let url = '/api/admin/manutencoes/todas';
        
        if (equipId && equipId.trim() !== "") {
            url += `?equipment_id=${parseInt(equipId)}`;
        }

        const response = await fetch(url);
        const manutencoes = await response.json();

        if (!Array.isArray(manutencoes)) {
            console.error("O backend não retornou uma lista:", manutencoes);
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro no formato dos dados retornados.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';

        if (manutencoes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma manutenção agendada encontrada.</td></tr>';
            return;
        }

        manutencoes.forEach(mt => {
            const dataInicio = new Date(mt.start_time).toLocaleString('pt-BR');
            const dataFim = new Date(mt.end_time).toLocaleString('pt-BR');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${mt.equipment?.name || 'Sem Nome'}</strong></td>
                <td>${dataInicio}</td>
                <td>${dataFim}</td>
                <td>${mt.description || '-'}</td>
                <td>
                    <button class="btn-excluir" onclick="deletarManutencao(${mt.id})" style="padding: 4px 8px; font-size: 12px;">
                        Remover
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Erro ao carregar tabela de manutenções:", error);
        tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados.</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectMaint = document.getElementById('maintEquipamentoId');
    if (selectMaint) {
        selectMaint.addEventListener('change', carregarTabelaManutencoes);
    }
    
    // 🔥 CHAVE DO SUCESSO: Chama a função assim que a página carrega!
    // Como o select vai iniciar vazio, ele vai trazer tudo automaticamente.
    carregarTabelaManutencoes(); 
});


async function deletarManutencao(id) {
    if (!confirm("Tem certeza que deseja encerrar/remover esta manutenção? O horário voltará a ficar disponível.")) return;

    try {
        const response = await fetch(`/api/admin/manutencao/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert("Manutenção removida!");
            carregarTabelaManutencoes();
            if (typeof calendar !== 'undefined' && calendar && typeof calendar.refetchEvents === 'function') {
                calendar.refetchEvents();
            } else {
                console.warn("Calendário não estava pronto para atualizar as manutenções.");
            }
        } else {
            alert("Erro ao remover manutenção.");
        }
    } catch (error) {
        console.error("Erro:", error);
    }
}

async function montarPagina() {
    // Para a execução de todo o resto se a sessão for inválida
    const autorizado = await verificarSessao();
    if (!autorizado) return;

    // Se passou na segurança, mostra o dashboard e carrega os dados
    document.querySelector('.dashboard-container').style.display = 'flex';
    await carregarMenu(); 
    console.log("Sistema em modo de acesso seguro. Autenticado.");
}

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: USUÁRIOS INTERNOS LOGIN LOCAL (SEM LDAP)
// -----------------------------------------------------------------------------

async function carregarDadosUsuariosInternos() {
    try {
        const res = await fetch('/api/usuarios-internos');
        const usuarios = await res.json();
        const tabela = document.getElementById('tabelaAdminInternos');
        
        tabela.innerHTML = usuarios.map(u => `
            <tr>
                <td>
                    <strong>${u.username}</strong>
                    ${u.is_admin ? '<span style="font-size:0.75rem; background:#8e44ad; color:white; padding:2px 6px; border-radius:10px; margin-left:8px; font-weight:bold;">🛡️ Admin</span>' : ''}
                </td>
                <td>${u.expiration_date ? new Date(u.expiration_date).toLocaleDateString('pt-BR') : '<span style="color:#27ae60;">Vitalício</span>'}</td>
                <td>${verificarStatusGeral(u.expiration_date, u.is_active)}</td>
                <td style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="editarUsuarioInterno('${u.username}', '${u.expiration_date || ''}')" style="background: none; border: none; cursor: pointer; color: #2980b9; font-weight: bold;" title="Alterar Validade">
                        ✏️ Validade
                    </button>
                    
                    <button onclick="alternarAdminInterno('${u.username}', ${u.is_admin})" style="background: none; border: none; cursor: pointer; color: #8e44ad; font-weight: bold;" title="Tornar/Remover Admin">
                        👑 ${u.is_admin ? 'Remover Admin' : 'Virar Admin'}
                    </button>
                    
                    <button onclick="alternarStatusInterno('${u.username}', ${u.is_active})" style="background: none; border: none; cursor: pointer; color: ${u.is_active ? '#e74c3c' : '#27ae60'}; font-weight: bold;" title="Ativar/Desativar Usuário">
                        ${u.is_active ? '🚫 Desativar' : '✅ Ativar'}
                    </button>
                    
                    <button onclick="excluirUsuarioInterno(${u.id})" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-weight: bold;" title="Excluir definitivamente do banco">
                        🗑️ Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
    }
}


async function editarUsuarioInterno(username, dataAtual) {
    const valorPadrao = dataAtual && dataAtual !== 'null' ? dataAtual.split('T')[0] : '';
    
    // O segredo está aqui: avisamos o admin que deixar vazio significa vitalício
    const novaData = prompt(`Defina a data limite de acesso para ${username}\nDeixe EM BRANCO para acesso VITALÍCIO.\n(Formato: AAAA-MM-DD):`, valorPadrao);
    
    if (novaData === null) return; // Se clicou em cancelar

    const payload = {
        username: username,
        // Se a string tem texto, envia a data. Se está vazia, envia 'null' para o banco.
        expiration_date: novaData.trim() !== '' ? new Date(novaData).toISOString() : null
    };

    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos(); 
    } else {
        alert("Erro ao atualizar a data de validade.");
    }
}

async function alternarAdminInterno(username, is_admin_atual) {
    const novoStatus = !is_admin_atual;
    const acao = novoStatus ? "CONCEDER" : "REMOVER";
    
    if (!confirm(`Deseja realmente ${acao} privilégios de Administrador para ${username}?`)) return;

    const payload = {
        username: username,
        is_admin: novoStatus
    };

    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos();
    } else {
        alert("Erro ao alterar privilégios.");
    }
}

async function alternarStatusInterno(username, is_active_atual) {
    const novoStatus = !is_active_atual; // Se é falso vira verdadeiro, se é verdadeiro vira falso
    const acao = novoStatus ? "ATIVAR" : "DESATIVAR";
    
    if (!confirm(`Deseja realmente ${acao} o acesso de ${username}?`)) return;

    // Envia a ordem para o backend mudar o campo is_active
    const payload = {
        username: username,
        is_active: novoStatus
    };

    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos(); // Atualiza a tela instantaneamente
    } else {
        alert("Erro ao alterar o status do usuário.");
    }
}

async function excluirUsuarioInterno(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário DE FORMA PERMANENTE do banco de dados?")) return;

    const res = await fetch(`/api/usuarios-internos/${id}`, {
        method: 'DELETE'
    });

    if (res.ok) {
        alert("Usuário excluído com sucesso!");
        carregarDadosUsuariosInternos();
    } else {
        const erro = await res.json();
        alert(erro.detail || "Erro ao excluir usuário.");
    }
}

// -----------------------------------------------------------------------------
// FUNÇÕES DA ABA: USUÁRIOS PENDENTES LOGIN LOCAL (SEM LDAP)
// -----------------------------------------------------------------------------

async function carregarDadosUsuariosPendentes() {
    try {
        const res = await fetch('/api/usuarios-pendentes');
        const usuarios = await res.json();
        const tabela = document.getElementById('tabelaAdminPendentes');
        
        tabela.innerHTML = usuarios.map(u => `
            <tr>
                <td>
                    <strong>${u.username}</strong>
                </td>
                <td>${u.email}</td>
                <td>${u.is_external ? 'Externo' : 'Interno'}</td>
                <td>${u.expiration_date ? new Date(u.expiration_date).toLocaleDateString('pt-BR') : '<span style="color:#27ae60;">Vitalício</span>'}</td>
                <td>${verificarStatusAcesso(u.expiration_date)}</td>
                <td>${verificarStatusAtivacao(u.is_active)}</td>
                
                <td style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="editarUsuarioInterno('${u.username}', '${u.expiration_date || ''}')" style="background: none; border: none; cursor: pointer; color: #2980b9; font-weight: bold;" title="Alterar Validade">
                        ✏️ Validade
                    </button>
                                        
                    <button onclick="alternarStatusInterno('${u.username}', ${u.is_active})" style="background: none; border: none; cursor: pointer; color: ${u.is_active ? '#e74c3c' : '#27ae60'}; font-weight: bold;" title="Ativar/Desativar Usuário">
                        ${u.is_active ? '🚫 Desativar' : '✅ Ativar'}
                    </button>
                    
                    <button onclick="excluirUsuarioInterno(${u.id})" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-weight: bold;" title="Excluir definitivamente do banco">
                        🗑️ Excluir
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
    }
}

// function verificarValidadeInterno(data, is_active) {
//     if (is_active === false) return '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
//     if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
//     const hoje = new Date();
//     const exp = new Date(data);
//     return exp < hoje 
//         ? '<span style="color: #e74c3c; font-weight: bold;">Expirado</span>' 
//         : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
// }

async function editarUsuarioInterno(username, dataAtual) {
    const valorPadrao = dataAtual && dataAtual !== 'null' ? dataAtual.split('T')[0] : '';
    
    // O segredo está aqui: avisamos o admin que deixar vazio significa vitalício
    const novaData = prompt(`Defina a data limite de acesso para ${username}\nDeixe EM BRANCO para acesso VITALÍCIO.\n(Formato: AAAA-MM-DD):`, valorPadrao);
    
    if (novaData === null) return; // Se clicou em cancelar

    const payload = {
        username: username,
        // Se a string tem texto, envia a data. Se está vazia, envia 'null' para o banco.
        expiration_date: novaData.trim() !== '' ? new Date(novaData).toISOString() : null
    };

    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos(); 
    } else {
        alert("Erro ao atualizar a data de validade.");
    }
}

async function alternarAdminInterno(username, is_admin_atual) {
    const novoStatus = !is_admin_atual;
    const acao = novoStatus ? "CONCEDER" : "REMOVER";
    
    if (!confirm(`Deseja realmente ${acao} privilégios de Administrador para ${username}?`)) return;

    const payload = {
        username: username,
        is_admin: novoStatus
    };

    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos();
    } else {
        alert("Erro ao alterar privilégios.");
    }
}

// async function desativarUsuarioInterno(username) {
//     if (!confirm(`Deseja revogar imediatamente o acesso de ${username}?`)) return;

//     // Define a validade para ontem para "Expirar" o acesso no mesmo momento
//     const ontem = new Date();
//     ontem.setDate(ontem.getDate() - 1);

//     const payload = {
//         username: username,
//         expiration_date: ontem.toISOString()
//     };

//     const res = await fetch('/api/usuarios-internos', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload)
//     });

//     if (res.ok) {
//         alert("Acesso desativado!");
//         carregarDadosUsuariosInternos();
//     } else {
//         alert("Erro ao desativar usuário.");
//     }
// }

async function alternarStatusInterno(username, is_active_atual) {
    const novoStatus = !is_active_atual; // Se é falso vira verdadeiro, se é verdadeiro vira falso
    const acao = novoStatus ? "ATIVAR" : "DESATIVAR";
    
    if (!confirm(`Deseja realmente ${acao} o acesso de ${username}?`)) return;

    // Envia a ordem para o backend mudar o campo is_active
    const payload = {
        username: username,
        is_active: novoStatus
    };

    const res = await fetch('/api/usuarios-internos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        carregarDadosUsuariosInternos(); // Atualiza a tela instantaneamente
    } else {
        alert("Erro ao alterar o status do usuário.");
    }
}

async function excluirUsuarioInterno(id) {
    if (!confirm("Tem certeza que deseja excluir este usuário DE FORMA PERMANENTE do banco de dados?")) return;

    const res = await fetch(`/api/usuarios-internos/${id}`, {
        method: 'DELETE'
    });

    if (res.ok) {
        alert("Usuário excluído com sucesso!");
        carregarDadosUsuariosInternos();
    } else {
        const erro = await res.json();
        alert(erro.detail || "Erro ao excluir usuário.");
    }
}

// async function editarUsuarioInterno(username, dataAtual) {
//     // Facilita o preenchimento convertendo a data existente
//     const valorPadrao = dataAtual ? dataAtual.split('T')[0] : '';
//     const novaData = prompt(`Defina a data limite de acesso para ${username}\n(Formato: AAAA-MM-DD):`, valorPadrao);
    
//     if (!novaData) return; // Se o admin cancelar o prompt

//     // Monta o payload exatamente como o UsuarioInternoConfig do FastAPI exige
//     const payload = {
//         username: username,
//         expiration_date: new Date(novaData).toISOString()
//     };

//     const res = await fetch('/api/usuarios-internos', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload)
//     });

//     if (res.ok) {
//         alert("Validade atualizada com sucesso!");
//         carregarDadosUsuariosInternos(); // Recarrega a tabela imediatamente
//     } else {
//         alert("Erro ao atualizar a data de validade.");
//     }
// }

montarPagina();