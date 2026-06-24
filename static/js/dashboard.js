// ==========================================
// VARIÁVEIS GLOBAIS DE SESSÃO
// ==========================================
let currentCalendar = null;
let agendamentoEmEdicao = null;
const userId = localStorage.getItem('user_id');
const userName = localStorage.getItem('user_name');
const userIsExternal = localStorage.getItem('is_external') === 'true';

document.getElementById('userNameDisplay').innerText = userName;


// ==========================================
// IMPORTAÇÕES
// ==========================================
import { 
    verificarValidade,
    verificarStatusAcesso,
    verificarStatusAtivacao,
    verificarStatusGeral
} from './utils.js';

import {
    carregarDadosEquipamentosAdmin,
    abrirModalEditarEquipamento,
    fecharModalEquipamento,
    salvarEdicaoEquipamento,
    abrirModalEquipamento,
    removerEquipamento,
    carregarSelectEquipamentosManutencao,
    salvarManutencao,
    carregarTabelaManutencoes,
    deletarManutencao
} from './dashboard_admin_equipamentos.js';

import {
    carregarDadosUsuariosExternos,
    cadastrarUsuarioExterno,
    desativarUsuarioExterno,
    excluirUsuarioExterno,
    editarUsuarioExterno,
    carregarDadosUsuariosInternos,
    editarUsuarioInterno,
    alternarAdminInterno,
    alternarStatusInterno,
    excluirUsuarioInterno,
    carregarDadosUsuariosPendentes
} from './dashboard_admin_usuarios.js';

import {
    inicializarCalendario,
    abrirModal,
    fecharModal,
    salvarAgendamento,
    excluirAgendamento
} from './dashboard_calendario.js';

import {
    abrirGestaoResponsavel,
    cancelarReservaAdmin
} from './dashboard_gestao_reservas.js';

// ==========================================
// FUNÇÕES DE INICIALIZAÇÃO E SESSÃO
// ==========================================
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

async function montarPagina() {
    // Para a execução de todo o resto se a sessão for inválida
    const autorizado = await verificarSessao();
    if (!autorizado) return;

    // Se passou na segurança, mostra o dashboard e carrega os dados
    document.querySelector('.dashboard-container').style.display = 'flex';
    await carregarMenu();
    console.log("Sistema em modo de acesso seguro. Autenticado.");
}

// ==========================================
// EVENT LISTENERS GLOBAIS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    montarPagina();

    // --- Modais e Ajuda ---
    document.getElementById('btnAjuda')?.addEventListener('click', abrirModalAjuda);
    document.getElementById('btnFecharAjuda')?.addEventListener('click', fecharModalAjuda);

    // --- Navegação Admin  ---
    document.querySelectorAll('.btn-tab').forEach(botao => {
        botao.addEventListener('click', (e) => {
            const aba = e.target.getAttribute('data-aba');
            if (aba) mudarAbaAdmin(aba); // Chama a função passando o nome da aba
        });
    });

    // --- Gestão de Equipamentos ---
    document.getElementById('btnNovoEquipamento')?.addEventListener('click', abrirModalEquipamento);
    document.getElementById('btnFecharModalEquipamento')?.addEventListener('click', fecharModalEquipamento);
    document.getElementById('btnSalvarEquipamento')?.addEventListener('click', salvarEdicaoEquipamento);

    // --- Usuários Externos ---
    document.getElementById('btnCadastrarExterno')?.addEventListener('click', cadastrarUsuarioExterno);

    // --- Manutenção ---
    document.getElementById('formMaintAdmin')?.addEventListener('submit', salvarManutencao);

    // --- Navegação Geral ---
    document.getElementById('btnVoltarCalendario')?.addEventListener('click', voltarAoCalendario);

    // --- Agendamentos ---
    document.getElementById('btnFecharModalAgendamento')?.addEventListener('click', fecharModal);
    document.getElementById('btnExcluir')?.addEventListener('click', excluirAgendamento);
    document.getElementById('agendamentoForm')?.addEventListener('submit', salvarAgendamento);

    const selectMaint = document.getElementById('maintEquipamentoId');
    if (selectMaint) {
        selectMaint.addEventListener('change', carregarTabelaManutencoes);
    }

});

// ==========================================
// MENU LATERAL E SELEÇÃO DE EQUIPAMENTOS
// ==========================================
export async function carregarMenu() {
    const res = await fetch('/api/equipamentos');
    let equipamentos = await res.json();
    const menu = document.getElementById('listaEquipamentos');
    equipamentos.sort((a, b) => a.name.localeCompare(b.name));

    // 1. HTML limpo, sem onclick
    menu.innerHTML = `
        <div class="equipamentos-lista">
            ${equipamentos.map(eq => `
                <button class="menu-item-btn"
                        data-id="${eq.id}"
                        data-name="${eq.name}"
                        data-responsible="${eq.responsible_id || ''}">
                    ${eq.name}
                </button>
            `).join('')}
            <button id="btnAdmin" class="btn-admin" style="display: none;">
                🛡️ Administrador
            </button>
        </div>
    `;

    // 2. Anexando os eventos dinamicamente aos botões de equipamento
    const botoesEquipamento = menu.querySelectorAll('.menu-item-btn');
    botoesEquipamento.forEach(botao => {
        botao.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const nome = e.target.getAttribute('data-name');
            const responsibleId = e.target.getAttribute('data-responsible');
            
            if (id) {
                selecionarEquipamento(e.target, nome, id, responsibleId);
            }
        });
    });

    // 3. Listener do botão Admin
    const is_admin = localStorage.getItem('is_admin') === 'true';
    if (is_admin) {
        const elementoMenu = document.getElementById('btnAdmin');
        if (elementoMenu) {
            elementoMenu.style.display = 'block';
            elementoMenu.addEventListener('click', abrirGestaoAdmin);
        }
    }
}

function cliqueEquipamento(button) {
    const id = button.getAttribute('data-id');
    const nome = button.getAttribute('data-name');
    const responsibleId = button.getAttribute('data-responsible');

    if (id) {
        selecionarEquipamento(button, nome, id, responsibleId);
    }
}

function selecionarEquipamento(elemento, nome, id, responsibleId) {
    voltarAoCalendario();
    
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

// ==========================================
// NAVEGAÇÃO E ADMINISTRAÇÃO
// ==========================================
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

    // [TRUQUE]: Avisa o navegador que a tela mudou para o FullCalendar se recalcular
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 10);
}

function dropdownAlterado(select) {
    const id = select.value;
    const nome = select.options[select.selectedIndex].getAttribute('data-name');
    const responsibleId = select.options[select.selectedIndex].getAttribute('data-responsible');
    if (id) {
        selecionarEquipamento(select, nome, id, responsibleId);
    }
}

// --- MODAL DE AJUDA E CRÉDITOS ---
function abrirModalAjuda() {
    document.getElementById('modalAjuda').style.display = 'block';
}

function fecharModalAjuda() {
    document.getElementById('modalAjuda').style.display = 'none';
}

// ==========================================
// EXPORTAÇÕES GLOBAIS PARA INJEÇÃO DE HTML
// ==========================================
window.cliqueEquipamento = cliqueEquipamento;
window.dropdownAlterado = dropdownAlterado;