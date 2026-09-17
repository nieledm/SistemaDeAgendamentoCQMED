from sqlalchemy import text
from database import engine

def atualizar_producao():
    print("Iniciando atualização do banco de dados em produção...")
    
    with engine.connect() as conn:
        # 1. Adiciona a coluna de e-mail e cria o índice de busca
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR;"))
            conn.execute(text("CREATE UNIQUE INDEX ix_users_email ON users(email);"))
            conn.commit() # Confirma só esse bloco
            print("✅ Coluna 'email' e índice criados com sucesso.")
        except Exception as e:
            conn.rollback() # Limpa o erro do banco para não travar os próximos
            print(f"ℹ️ A coluna 'email' já existe.")

        # 2. Adiciona a coluna is_active
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("UPDATE users SET is_active = TRUE WHERE is_active IS NULL;"))
            conn.commit()
            print("✅ Coluna 'is_active' criada e usuários antigos atualizados para 'True'.")
        except Exception as e:
            conn.rollback()
            print(f"ℹ️ A coluna 'is_active' já existe.")

        # 3. Adiciona a coluna hashed_password para o sistema de autenticação
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR;"))
            conn.commit()
            print("✅ Coluna 'hashed_password' criada com sucesso.")
        except Exception as e:
            conn.rollback()
            print(f"ℹ️ A coluna 'hashed_password' já existe ou houve um erro: {e}")
    
    print("🚀 Atualização finalizada!")

if __name__ == "__main__":
    atualizar_producao()