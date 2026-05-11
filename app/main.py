from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, joinedload
import pandas as pd
import io, os
from pydantic import BaseModel
from datetime import datetime
import time

from . import models, database, schemas
from .auth import autenticar_e_obter_info

# Cria as tabelas ao iniciar
models.Base.metadata.create_all(bind=database.engine)

# Pega o caminho absoluto da pasta 'Agendamento' (um nível acima de onde este arquivo está)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI()


# --- CONFIGURAÇÃO DE ARQUIVOS ESTÁTICOS E TEMPLATES ---
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# --- MODELOS DE ENTRADA (PYDANTIC) ---
class LoginInternoRequest(BaseModel):
    username: str
    password: str

class LoginExternoRequest(BaseModel):
    email: str

# --- ROTAS DE NAVEGAÇÃO (PARA ABRIR AS TELAS) ---

@app.get("/")
async def rota_inicial(request: Request):
    # O segredo é usar context={"request": request}
    return templates.TemplateResponse(
        request=request, 
        name="index.html"
    )

@app.get("/login-interno")
async def tela_login_interno(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="login_interno.html"
    )

@app.get("/login-externo")
async def tela_login_externo(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="login_externo.html"
    )

@app.get("/dashboard")
async def tela_dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={
            "version": time.time()
        }
    )

####################### APIs ####################################

@app.post("/api/importar-excel")
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
# Para login e sincronização de usuários via AD
class LoginRequest(BaseModel):
    username: str
    password: str

models.Base.metadata.create_all(bind=database.engine)

@app.get("/api/equipamentos")
def listar_equipamentos(db: Session = Depends(database.get_db)):
    equipamentos = db.query(models.Equipment).all()
    return db.query(models.Equipment).all()

@app.post("/api/login-interno")
def login_interno(dados: LoginInternoRequest, db: Session = Depends(database.get_db)):
    # 1. Tenta autenticar no AD
    info_ad = autenticar_e_obter_info(dados.username, dados.password)
    
    if not info_ad:
        raise HTTPException(status_code=401, detail="Credenciais do AD inválidas")

    # 2. Sincroniza com o banco local
    user = db.query(models.User).filter(models.User.username == dados.username).first()
    
    # Determina se é admin
    is_admin = False
    for grupo in info_ad.get("grupos", []):
        if "admin" in grupo.lower() or "ti" in grupo.lower():
            is_admin = True
    if dados.username == "niele.mendes": is_admin = True

    if not user:
        user = models.User(
            username=dados.username,
            full_name=info_ad["nome"],
            is_admin=is_admin,
            is_external=False # Usuário AD nunca é externo
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Atualiza o status de admin caso tenha mudado no AD
        user.is_admin = is_admin
        db.commit()

    return {
        "status": "sucesso",
        "user_id": user.id,
        "username": user.username,
        "is_admin": user.is_admin
    }


@app.post("/api/login-externo")
def login_externo(dados: LoginExternoRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == dados.email).first()
    
    if not user:
        # Se o usuário não existe, cria como externo
        user = models.User(
            username=dados.email,
            full_name=dados.email,
            is_admin=False,
            is_external=True  # Trava de segurança
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return {
        "user_id": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
        "is_external": user.is_external
    }

@app.get("/api/verificar-acesso/{user_id}")
def verificar_acesso(user_id: int, db: Session = Depends(database.get_db)):
    usuario = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado. Por favor, faça login novamente.")

    # Regra de bloqueio para usuários externos (Pendente ou Expirado)
    if usuario.is_external:
        if not usuario.expiration_date:
            raise HTTPException(
                status_code=403, 
                detail="Acesso bloqueado. Seu status está pendente de liberação pelo administrador."
            )
        if usuario.expiration_date < datetime.utcnow():
            raise HTTPException(
                status_code=403, 
                detail=f"Acesso expirado. Sua validade encerrou em {usuario.expiration_date.strftime('%d/%m/%Y')}."
            )

    return {"status": "autorizado"}

################################################################
# Atribuir responsável a um equipamento
class AtribuirResponsavel(BaseModel):
    equipment_id: int
    user_id: int

@app.post("/api/admin/definir-responsavel")
def definir_responsavel(dados: AtribuirResponsavel, db: Session = Depends(database.get_db)):
    # 1. Busca o equipamento
    equip = db.query(models.Equipment).filter(models.Equipment.id == dados.equipment_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    # 2. Busca o usuário
    user = db.query(models.User).filter(models.User.id == dados.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # 3. Faz a ligação na tabela de equipamentos
    equip.responsible_id = user.id
    db.commit()
    
    return {"msg": f"Agora {user.username} é o responsável pelo equipamento {equip.name}"}

###########################################
# Rota de solicitação de agendamento de usuário externo

class ScheduleRequest(BaseModel):
    equipment_id: int
    user_id: int
    start_time: datetime
    end_time: datetime

@app.post("/api/agendar")
def criar_agendamento(agendamento: schemas.ScheduleCreate, db: Session = Depends(database.get_db)):
    usuario = db.query(models.User).filter(models.User.id == agendamento.user_id).first()
    equipamento = db.query(models.Equipment).filter(models.Equipment.id == agendamento.equipment_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Se for usuário externo, verifica a data de validade
    if usuario.is_external:
        if not usuario.expiration_date:
            raise HTTPException(
                status_code=403, 
                detail="Acesso bloqueado. Nenhuma data de validade foi configurada para este usuário externo."
            )
        
        if usuario.expiration_date < datetime.utcnow():
            raise HTTPException(
                status_code=403, 
                detail=f"Acesso expirado. A validade da sua conta encerrou em {usuario.expiration_date.strftime('%d/%m/%Y')}."
            )

    if "HPLC MS" in equipamento.name.upper() and usuario.is_external:
        raise HTTPException(
            status_code=403, 
            detail="O equipamento HPLC MS é restrito a usuários internos do CQMED."
        )

    novo_agendamento = models.Schedule(
        equipment_id=agendamento.equipment_id,
        user_id=agendamento.user_id,
        start_time=agendamento.start_time,
        end_time=agendamento.end_time,
    )
    db.add(novo_agendamento)
    db.commit()
    db.refresh(novo_agendamento)
    return novo_agendamento

###########################################################################
# Rotas para meus agendamentos, cancelamento e edição
@app.get("/api/meus-agendamentos/{user_id}")
def listar_meus_agendamentos(user_id: int, db: Session = Depends(database.get_db)):
    agendamentos = db.query(models.Schedule).filter(models.Schedule.user_id == user_id).all()
    return agendamentos

@app.delete("/api/agendamento/{schedule_id}")
def cancelar_agendamento(schedule_id: int, user_id: int, db: Session = Depends(database.get_db)):
    agendamento = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    solicitante = db.query(models.User).filter(models.User.id == user_id).first()
    if not solicitante:
        raise HTTPException(status_code=404, detail="Usuário solicitante não encontrado")

    equipamento = db.query(models.Equipment).filter(models.Equipment.id == agendamento.equipment_id).first()

    eh_dono = agendamento.user_id == user_id
    eh_admin = solicitante.is_admin
    eh_responsavel = getattr(equipamento, "responsible_id", None) == user_id

    if not (eh_dono or eh_admin or eh_responsavel):
        raise HTTPException(
            status_code=403, 
            detail="Você não tem permissão para cancelar este agendamento"
        )
    
    db.delete(agendamento)
    db.commit()
    return {"msg": "Agendamento removido com sucesso"}


@app.put("/api/agendamento/{schedule_id}")
def editar_agendamento(
    schedule_id: int, 
    dados: schemas.ScheduleUpdate,
    user_id: int,
    db: Session = Depends(database.get_db)
):
    agendamento = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")

    solicitante = db.query(models.User).filter(models.User.id == user_id).first()
    if not solicitante:
        raise HTTPException(status_code=404, detail="Usuário solicitante não encontrado")

    equipamento = db.query(models.Equipment).filter(models.Equipment.id == agendamento.equipment_id).first()

    # REGRA DE VALIDAÇÃO:
    eh_dono = agendamento.user_id == user_id
    eh_admin = solicitante.is_admin
    eh_responsavel = getattr(equipamento, "responsible_id", None) == user_id

    # Se NÃO for o dono, NÃO for admin E NÃO for o responsável, barra a edição
    if not (eh_dono or eh_admin or eh_responsavel):
        raise HTTPException(
            status_code=403, 
            detail="Você não tem permissão para editar este agendamento"
        )

    conflito = db.query(models.Schedule).filter(
        models.Schedule.equipment_id == agendamento.equipment_id,
        models.Schedule.id != schedule_id,
        models.Schedule.start_time < dados.end_time,
        models.Schedule.end_time > dados.start_time
    ).first()

    if conflito:
        raise HTTPException(
            status_code=400, 
            detail="O novo horário escolhido já está ocupado"
        )

    agendamento.start_time = dados.start_time
    agendamento.end_time = dados.end_time
    db.commit()
    db.refresh(agendamento)
    
    return {"msg": "Agendamento atualizado com sucesso", "agendamento": agendamento}

@app.get("/api/eventos/{equipment_id}")
def listar_eventos(equipment_id: int, user_id: int, db: Session = Depends(database.get_db)):
    agendamentos = db.query(models.Schedule).filter(
        models.Schedule.equipment_id == equipment_id,
    ).all()
    usuario_logado = db.query(models.User).filter(models.User.id == user_id).first()
    
    usuario_logado = db.query(models.User).filter(models.User.id == user_id).first()

    eventos = []
    for ag in agendamentos:
        if not usuario_logado.is_external or ag.user_id == user_id:
            label = f" {ag.user.full_name or ag.user.username}"
        else:
            label = "Horário Reservado"
            
        eventos.append({
            "id": ag.id,
            "title": label,
            "start": ag.start_time,
            "end": ag.end_time,
            "color": "#7f8c8d" if usuario_logado.is_external and ag.user_id != user_id else "#3498db"
        })
    return eventos

@app.get("/api/admin/agendamentos-geral")
def listar_todos_agendamentos(db: Session = Depends(database.get_db)):
    # Retorna todos os agendamentos futuros com dados do usuário
    return db.query(models.Schedule)\
        .options(joinedload(models.Schedule.user), joinedload(models.Schedule.equipment))\
        .filter(models.Schedule.start_time >= datetime.utcnow())\
        .all()

@app.get("/api/admin/monitorar-reservas")
def monitorar_reservas(db: Session = Depends(database.get_db)):
    # Retorna agendamentos futuros com dados do usuário e equipamento
    return db.query(models.Schedule)\
        .options(joinedload(models.Schedule.user), joinedload(models.Schedule.equipment))\
        .filter(models.Schedule.start_time >= datetime.utcnow())\
        .order_by(models.Schedule.start_time.asc())\
        .all()

##############################################################
# PAINEL DE ADMINISTRAÇÃO - GESTÃO DE USUÁRIOS E EQUIPAMENTOS
##############################################################

# --- ESQUEMAS PYDANTIC (Para validar os dados recebidos do JS) ---
class EquipamentoCreate(BaseModel):
    name: str
    responsible_id: Optional[int] = None

class EquipamentoUpdate(BaseModel):
    name: str
    responsible_id: Optional[int] = None

class UsuarioExternoConfig(BaseModel):
    email: str
    expiration_date: datetime

# --- OBTER USUÁRIOS DO AD ---
@app.get("/api/admin/usuarios-internos")
def listar_usuarios_internos(db: Session = Depends(database.get_db)):
    # Retorna apenas os usuários que NÃO são externos (potenciais responsáveis)
    return db.query(models.User).filter(models.User.is_external == False).all()

# --- GESTÃO DE EQUIPAMENTOS ---

@app.get("/api/admin/equipamentos")
def listar_equipamentos_admin(db: Session = Depends(database.get_db)):
    # Retorna a lista completa; o SQLAlchemy converte para JSON automaticamente no FastAPI
    return db.query(models.Equipment).all()

@app.post("/api/admin/equipamentos", status_code=201)
def criar_equipamento(dados: EquipamentoCreate, db: Session = Depends(database.get_db)):
    novo_eq = models.Equipment(
        name=dados.name, 
        responsible_id=dados.responsible_id
    )
    db.add(novo_eq)
    db.commit()
    db.refresh(novo_eq)
    return {"id": novo_eq.id, "message": "Equipamento adicionado"}

@app.put("/api/admin/equipamento/{eq_id}")
def editar_equipamento(eq_id: int, dados: EquipamentoUpdate, db: Session = Depends(database.get_db)):
    eq = db.query(models.Equipment).filter(models.Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    eq.name = dados.name
    eq.responsible_id = dados.responsible_id
    db.commit()
    return {"message": "Atualizado com sucesso"}

@app.delete("/api/admin/equipamento/{eq_id}")
def remover_equipamento(eq_id: int, db: Session = Depends(database.get_db)):
    eq = db.query(models.Equipment).filter(models.Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    db.delete(eq)
    db.commit()
    return {"message": "Removido com sucesso"}

# --- GESTÃO DE USUÁRIOS EXTERNOS ---

@app.get("/api/admin/usuarios-externos")
def listar_usuarios_externos(db: Session = Depends(database.get_db)):
    # Retorna apenas os usuários que são externos
    usuarios = db.query(models.User).filter(models.User.is_external == True).all()
    return usuarios

@app.post("/api/admin/usuarios-externos")
def configurar_usuario_externo(dados: UsuarioExternoConfig, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == dados.email).first()
    
    if not user:
        # Cria o usuário externo se ele ainda não existir no banco
        user = models.User(
            username=dados.email,
            full_name=dados.email,
            is_admin=False,
            is_external=True
        )
        db.add(user)
    
    # ATENÇÃO: Para isso funcionar, você precisa adicionar a coluna 'expiration_date' no seu models.py
    user.expiration_date = dados.expiration_date
    db.commit()
    
    return {"message": "Acesso externo configurado com sucesso"}