import os
from ldap3 import Server, Connection, ALL, SIMPLE

# Se for rodar fora do Docker, descomente as linhas abaixo para carregar o .env
# from dotenv import load_dotenv
# load_dotenv()

def autenticar_e_obter_info(username, password):
    # Puxa as variáveis de ambiente, com valores padrão como fallback (opcional)
    LDAP_SERVER = os.getenv('LDAP_SERVER')
    LDAP_DOMAIN = os.getenv('LDAP_DOMAIN')
    SEARCH_BASE = os.getenv('LDAP_SEARCH_BASE')

    if not all([LDAP_SERVER, LDAP_DOMAIN, SEARCH_BASE]):
        print("Erro: Variáveis de ambiente do LDAP não configuradas corretamente.")
        return None

    # Monta a string no formato DOMINIO\usuario
    USER_DN = fr"{LDAP_DOMAIN}\{username}" 

    try:
        server = Server(LDAP_SERVER, get_info=ALL)
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
                # memberOf vem como uma lista de strings (DNs dos grupos)
                grupos = entry.memberOf.values if 'memberOf' in entry else []
                nome = str(entry.displayName) if 'displayName' in entry else username
                conn.unbind()
                return {"grupos": grupos, "nome": nome}
            
            conn.unbind()
        return None
    except Exception as e:
        print(f"Erro no LDAP: {e}")
        return None