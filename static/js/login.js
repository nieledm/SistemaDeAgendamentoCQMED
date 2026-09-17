async function realizarLogin(event, tipo) {
    event.preventDefault(); // Impede o recarregamento da página
    
    const errorDiv = document.getElementById('error');
    if (errorDiv) errorDiv.style.display = 'none';

    let url = '';
    let fetchOptions = {}; // Armazena as configurações da requisição dinamicamente

    if (tipo === 'interno') {
        url = '/api/login-interno';
        // O FastAPI com OAuth2 exige envio via URLSearchParams (Form Data)
        const formData = new URLSearchParams();
        formData.append('username', document.getElementById('username').value);
        formData.append('password', document.getElementById('password').value);
        
        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        };
    } else {
        url = '/api/login-externo';
        // O login externo continua enviando JSON
        const payload = {
            email: document.getElementById('email').value
        };
        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        };
    }

    try {
        // Envia a requisição com as opções corretas para cada tipo
        const response = await fetch(url, fetchOptions);

        if (response.ok) {
            const data = await response.json();
            
            // Salva as credenciais para usar no agendamento e dashboard
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('user_name', data.username);
            localStorage.setItem('is_admin', data.is_admin);
            localStorage.setItem('is_external', data.is_external);
            
            // Salva o token JWT para enviar nas próximas requisições seguras
            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token);
            }
            
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