from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de conexão: postgresql://usuario:senha@host:porta/nome_do_banco
# SQLALCHEMY_DATABASE_URL = "postgresql://admin:password123@db:5432/scheduling_lab"
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:password123@localhost:5432/scheduling_lab"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência que o FastAPI usará para abrir/fechar a conexão em cada requisição
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()