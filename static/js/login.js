async function realizarLogin(event, tipo) {
    event.preventDefault(); // Impede o recarregamento da página
    
    const errorDiv = document.getElementById('error');
    if (errorDiv) errorDiv.style.display = 'none';

    let url = '';
    let payload = {};

    if (tipo === 'interno') {
        url = '/api/login-interno';
        payload = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };
    } else {
        url = '/api/login-externo';
        payload = {
            email: document.getElementById('email').value
        };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            // Salva as credenciais para usar no agendamento e dashboard
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('user_name', data.username);
            localStorage.setItem('is_admin', data.is_admin);
            localStorage.setItem('is_external', data.is_external);
            
            // Redireciona para o dashboard do sistema
            window.location.href = '/dashboard';
        } else {
            if (errorDiv) errorDiv.style.display = 'block';
        }
    } catch (err) {
        console.error("Erro na conexão com o servidor:", err);
        alert("Erro de conexão. O servidor FastAPI está rodando?");
    }
}