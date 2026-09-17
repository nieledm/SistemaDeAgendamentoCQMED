import os
import ssl
import jwt
from datetime import datetime, timedelta, timezone
from ldap3 import Server, Connection, ALL, SIMPLE, Tls

# Se for rodar fora do Docker, descomente as linhas abaixo para carregar o .env
# from dotenv import load_dotenv
# load_dotenv()

# Lê a chave secreta do seu .env (fundamental para a segurança do token)
SECRET_KEY = os.getenv("SECRET_KEY", "chave_secreta_padrao_para_desenvolvimento")
ALGORITHM = "HS256"

# Define o tempo que o usuário pode ficar logado sem mexer no sistema (ex: 2 horas)
ACCESS_TOKEN_EXPIRE_MINUTES = 120 

def criar_token_jwt(data: dict):
    # Cria uma cópia dos dados do usuário (ex: {"sub": "admin"})
    to_encode = data.copy()
    
    # Calcula exatamente o minuto em que o "crachá" perde a validade
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Adiciona a data de expiração aos dados
    to_encode.update({"exp": expire})
    
    # Assina e criptografa o token usando a sua chave secreta e o algoritmo HS256
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt

def autenticar_e_obter_info(username, password):
    # Puxa as variáveis de ambiente, com valores padrão como fallback (opcional)
    LDAP_SERVER = os.getenv('LDAP_SERVER')
    LDAP_DOMAIN = os.getenv('LDAP_DOMAIN')
    SEARCH_BASE = os.getenv('LDAP_SEARCH_BASE')

    if LDAP_SERVER is None or LDAP_DOMAIN is None or SEARCH_BASE is None:
        print("Erro: Variáveis de ambiente do LDAP não configuradas corretamente.")
        return None

    USER_DN = fr"{LDAP_DOMAIN}\{username}" 

    tls_configuration = Tls(validate=ssl.CERT_NONE, version=ssl.PROTOCOL_TLSv1_2)

    try:
        # 
        server = Server(
            LDAP_SERVER, 
            port=636, 
            use_ssl=True, 
            tls=tls_configuration, 
            get_info=ALL
        )

        conn = Connection(server, user=USER_DN, password=password, authentication=SIMPLE)
        
        if conn.bind():
            # Busca os grupos (memberOf) e o nome exibido usando a variável de ambiente
            conn.search(
                search_base=SEARCH_BASE, 
                search_filter=f'(sAMAccountName={username})',
                attributes=['memberOf', 'displayName']
            )
            
            if conn.entries:
                entry = conn.entries[0]
                grupos = entry.memberOf.values if 'memberOf' in entry else []
                nome = str(entry.displayName) if 'displayName' in entry else username
                conn.unbind()
                return {"grupos": grupos, "nome": nome}
            
            conn.unbind()
        return None
    except Exception as e:
        print(f"Erro no LDAP: {e}")
        return None