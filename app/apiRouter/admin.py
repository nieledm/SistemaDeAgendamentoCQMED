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

##############################################################
# GESTÃO DE MANUTENÇÃO DE EQUIPAMENTOS
##############################################################

@router.post("/api/admin/manutencao")
def criar_manutencao(dados: schemas.MaintenanceCreate, db: Session = Depends(database.get_db)):
    # 1. Verificar se o equipamento existe
    equip = db.query(models.Equipment).filter(models.Equipment.id == dados.equipment_id).first()
    if not equip:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")

    # 2. Verificar se já existem agendamentos no período
    conflitos = db.query(models.Schedule).filter(
        models.Schedule.equipment_id == dados.equipment_id,
        models.Schedule.start_time < dados.end_time,
        models.Schedule.end_time > dados.start_time
    ).all()

    # Se houver conflitos "limpamos" o calendário para a manutenção:
    for agendamento in conflitos:
        db.delete(agendamento)

    # 3. Criar o registro de manutenção
    nova_manutencao = models.equipment_maintenances(
        equipment_id=dados.equipment_id,
        start_time=dados.start_time,
        end_time=dados.end_time,
        description=dados.description,
        created_user=dados.create_user
    )
    
    db.add(nova_manutencao)
    db.commit()
    db.refresh(nova_manutencao)
    
    return {
        "status": "sucesso", 
        "msg": f"Equipamento {equip.name} colocado em manutenção. {len(conflitos)} agendamentos foram removidos."
    }

@router.get("/api/manutencoes/{equipment_id}", response_model=list[schemas.MaintenanceResponse])
def listar_manutencoes(equipment_id: int, db: Session = Depends(database.get_db)):
    # Retorna as manutenções para exibir no calendário (em vermelho)
    return db.query(models.equipment_maintenances) \
             .options(joinedload(models.equipment_maintenances.equipment))\
             .filter(models.equipment_maintenances.equipment_id == equipment_id)\
             .all()

@router.get("/api/admin/manutencoes/todas")
def listar_todas_manutencoes(
    equipment_id: int | None = None,
    db: Session = Depends(database.get_db)
):
    agora = datetime.now()
    
    query = db.query(models.equipment_maintenances)\
              .options(joinedload(models.equipment_maintenances.equipment))\
              .filter(models.equipment_maintenances.end_time >= agora)
    
    if equipment_id is not None:
        query = query.filter(models.equipment_maintenances.equipment_id == equipment_id)
        
    return query.order_by(models.equipment_maintenances.start_time.asc()).all()

@router.delete("/api/admin/manutencao/{maint_id}")
def remover_manutencao(maint_id: int, db: Session = Depends(database.get_db)):
    maint = db.query(models.equipment_maintenances).filter(models.equipment_maintenances.id == maint_id).first()
    if not maint:
        raise HTTPException(status_code=404, detail="Manutenção não encontrada")
    
    db.delete(maint)
    db.commit()
    return {"msg": "Manutenção removida com sucesso"}