from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from app import models, database, schemas

router = APIRouter()

@router.get("/api/admin/agendamentos-geral")
def listar_todos_agendamentos(db: Session = Depends(database.get_db)):
    # Retorna todos os agendamentos futuros com dados do usuário
    return db.query(models.Schedule)\
        .options(joinedload(models.Schedule.user), joinedload(models.Schedule.equipment))\
        .filter(models.Schedule.start_time >= datetime.utcnow())\
        .all()

@router.get("/api/admin/monitorar-reservas")
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

# --- OBTER USUÁRIOS DO AD ---
@router.get("/api/admin/usuarios-internos")
def listar_usuarios_internos(db: Session = Depends(database.get_db)):
    # Retorna apenas os usuários que NÃO são externos (potenciais responsáveis)
    return db.query(models.User).filter(models.User.is_external == False).all()

# --- GESTÃO DE EQUIPAMENTOS ---

@router.get("/api/admin/equipamentos")
def listar_equipamentos_admin(db: Session = Depends(database.get_db)):
    # Retorna a lista completa; o SQLAlchemy converte para JSON automaticamente no FastAPI
    return db.query(models.Equipment).all()

@router.post("/api/admin/equipamentos", status_code=201)
def criar_equipamento(dados: schemas.EquipamentoCreate, db: Session = Depends(database.get_db)):
    novo_eq = models.Equipment(
        name=dados.name, 
        responsible_id=dados.responsible_id
    )
    db.add(novo_eq)
    db.commit()
    db.refresh(novo_eq)
    return {"id": novo_eq.id, "message": "Equipamento adicionado"}

@router.put("/api/admin/equipamento/{eq_id}")
def editar_equipamento(eq_id: int, dados: schemas.EquipamentoUpdate, db: Session = Depends(database.get_db)):
    eq = db.query(models.Equipment).filter(models.Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    eq.name = dados.name
    eq.responsible_id = dados.responsible_id
    db.commit()
    return {"message": "Atualizado com sucesso"}

@router.delete("/api/admin/equipamento/{eq_id}")
def remover_equipamento(eq_id: int, db: Session = Depends(database.get_db)):
    eq = db.query(models.Equipment).filter(models.Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    db.delete(eq)
    db.commit()
    return {"message": "Removido com sucesso"}

# --- GESTÃO DE USUÁRIOS EXTERNOS ---

@router.get("/api/admin/usuarios-externos")
def listar_usuarios_externos(db: Session = Depends(database.get_db)):
    # Retorna apenas os usuários que são externos
    usuarios = db.query(models.User).filter(models.User.is_external == True).all()
    return usuarios

@router.post("/api/admin/usuarios-externos")
def configurar_usuario_externo(dados: schemas.UsuarioExternoConfig, db: Session = Depends(database.get_db)):
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

@router.post("/api/admin/definir-responsavel")
def definir_responsavel(dados: schemas.AtribuirResponsavel, db: Session = Depends(database.get_db)):
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