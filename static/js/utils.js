// -----------------------------------------------------------------------------
// FUNÇÕES DE VERIFICAÇÃO
// -----------------------------------------------------------------------------

export function verificarValidade(data, is_active) {
    if (is_active === false) return '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
    if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
    const hoje = new Date();
    const exp = new Date(data);
    return exp < hoje 
        ? '<span style="color: #e74c3c; font-weight: bold;">Expirado</span>' 
        : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
}

// Checa apenas o Calendário (O prazo venceu?)
export function verificarStatusAcesso(data) {
    if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
    const hoje = new Date();
    const exp = new Date(data);
    return exp < hoje 
        ? '<span style="color: #e74c3c; font-weight: bold;">Expirado</span>' 
        : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
}

// Checa apenas o Disjuntor da Conta (A conta está bloqueada no banco?)
export function verificarStatusAtivacao(is_active) {
    return is_active === true
        ? '<span style="color: #27ae60; font-weight: bold;">Ativo</span>'
        : '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
}

// Combina os dois para tabelas mais simples (Ex: Aba Externos)
export function verificarStatusGeral(data, is_active) {
    if (is_active === false) return '<span style="color: #e74c3c; font-weight: bold;">Desativado</span>';
    if (!data || data === 'null') return '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
    
    const hoje = new Date();
    const exp = new Date(data);
    return exp < hoje 
        ? '<span style="color: #f39c12; font-weight: bold;">Expirado</span>' 
        : '<span style="color: #27ae60; font-weight: bold;">Ativo</span>';
}



