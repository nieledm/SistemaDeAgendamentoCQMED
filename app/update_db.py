from sqlalchemy import text
from database import engine

def atualizar_producao():
    print("Iniciando atualização do banco de dados em produção...")
    
    with engine.connect() as conn:
        # 1. Adiciona a coluna de e-mail e cria o índice de busca
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR;"))
            conn.execute(text("CREATE UNIQUE INDEX ix_users_email ON users(email);"))
            print("✅ Coluna 'email' e índice criados com sucesso.")
        except Exception as e:
            print(f"⚠️ A coluna 'email' já existe ou houve um erro: {e}")

        # 2. Adiciona a coluna is_active e garante que os usuários antigos continuem ativos
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;"))
            # Atualiza quem já estava no banco para não perder o acesso
            conn.execute(text("UPDATE users SET is_active = TRUE WHERE is_active IS NULL;"))
            print("✅ Coluna 'is_active' criada e usuários antigos atualizados para 'True'.")
        except Exception as e:
            print(f"⚠️ A coluna 'is_active' já existe ou houve um erro: {e}")

        # Confirma as alterações no banco
        conn.commit()
    
    print("🚀 Atualização finalizada!")

if __name__ == "__main__":
    atualizar_producao()