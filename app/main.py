from fastapi import FastAPI, Depends, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import pandas as pd
import io, os
import time

from . import models, database
from .database import SessionLocal

# Cria as tabelas ao iniciar
models.Base.metadata.create_all(bind=database.engine)

# Configuração para criptografar a senha do modo local
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def criar_admin_inicial():
    db = SessionLocal()
    try:
        # Verifica se já existe algum usuário no banco
        usuario_existente = db.query(models.User).first()
        
        if not usuario_existente:
            print("⏳ Inicializando sistema: Criando usuário Admin padrão...")
            senha_criptografada = pwd_context.hash("admin123")
            
            novo_admin = models.User(
                username="admin",
                full_name="Administrador do Sistema",
                is_admin=True,
                hashed_password=senha_criptografada
            )
            db.add(novo_admin)
            db.commit()
            print("✅ Admin criado! Login: admin | Senha: admin123")
    finally:
        db.close()

# Executa a verificação assim que a aplicação iniciar
criar_admin_inicial()

# Pega o caminho absoluto da pasta 'Agendamento' (um nível acima de onde este arquivo está)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI()


############################################################################
#  ROTAS DE PÁGINAS (Telas HTML)
############################################################################

# --- CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS E TEMPLATES ---
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

@app.get("/", tags=["Rotas"])
async def rota_inicial(request: Request):
    # O segredo é usar context={"request": request}
    return templates.TemplateResponse(
        request=request, 
        name="index.html"
    )

@app.get("/login-interno", tags=["Rotas"])
async def tela_login_interno(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="login_interno.html"
    )

@app.get("/login-externo", tags=["Rotas"])
async def tela_login_externo(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="login_externo.html"
    )

@app.get("/dashboard", tags=["Rotas"])
async def tela_dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "version": time.time()
        }
    )

####################### APIs ####################################

@app.post("/api/importar-excel", tags=["Importar Excel"])
async def importar_equipamentos_excel(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    contents = await file.read()
    excel_data = pd.ExcelFile(io.BytesIO(contents))
    
    ignorar = ["Fluxos CBMEG CCR"]
    
    nomes_unicos = set()

    for nome_aba in excel_data.sheet_names:
        if nome_aba in ignorar:
            continue
        
        # Lógica do AKTA
        if nome_aba == "AKTA":
            nomes_unicos.add("AKTA 1")
            nomes_unicos.add("AKTA 2")
        else:
            nomes_unicos.add(nome_aba)

    # Agora sim, inserimos apenas o que não existe no DB
    for nome in nomes_unicos:
        # Verifica se já existe no Postgres
        existe = db.query(models.Equipment).filter(models.Equipment.name == nome).first()
        if not existe:
            novo_eq = models.Equipment(name=nome, description="Importado da planilha")
            db.add(novo_eq)
    
    db.commit()
    return {"status": "sucesso", "total_carregado": len(nomes_unicos)}

################################################################
# IMPORTANTO AS ROTAS DAS APIs
################################################################

import app.apiRouter.login as login_router
app.include_router(login_router.router)

import app.apiRouter.admin as admin_router
app.include_router(admin_router.router)

import app.apiRouter.agendamento as schedule_router
app.include_router(schedule_router.router)
