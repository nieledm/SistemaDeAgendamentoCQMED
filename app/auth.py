from ldap3 import Server, Connection, ALL, SIMPLE

def autenticar_e_obter_info(username, password):
    LDAP_SERVER = '177.220.86.20'
    
    USER_DN = fr"CQMED\{username}" 

    try:
        server = Server(LDAP_SERVER, get_info=ALL)
        conn = Connection(server, user=USER_DN, password=password, authentication=SIMPLE)
        
        if conn.bind():
            # Busca os grupos (memberOf) e o nome exibido
            conn.search(
                search_base='dc=cqmed,dc=unicamp,dc=br', 
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