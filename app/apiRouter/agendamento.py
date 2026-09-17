from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from app import models, database, schemas

router = APIRouter()

@router.get("/api/equipamentos", tags=["agendamentos"])
def listar_equipamentos(db: Session = Depends(database.get_db)):
    equipamentos = db.query(models.Equipment).all()
    return db.query(models.Equipment).all()

###########################################
# Rota de solicitação de agendamento de usuário externo

@router.post("/api/agendar", tags=["agendamentos"])
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
@router.get("/api/meus-agendamentos/{user_id}", tags=["agendamentos"])
def listar_meus_agendamentos(user_id: int, db: Session = Depends(database.get_db)):
    agendamentos = db.query(models.Schedule).filter(models.Schedule.user_id == user_id).all()
    return agendamentos

@router.delete("/api/agendamento/{schedule_id}", tags=["agendamentos"])
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


@router.put("/api/agendamento/{schedule_id}", tags=["agendamentos"])
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

# @router.get("/api/eventos/{equipment_id}")
# def listar_eventos(equipment_id: int, user_id: int, db: Session = Depends(database.get_db)):
#     agendamentos = db.query(models.Schedule).filter(
#         models.Schedule.equipment_id == equipment_id,
#     ).all()
#     usuario_logado = db.query(models.User).filter(models.User.id == user_id).first()
    
#     usuario_logado = db.query(models.User).filter(models.User.id == user_id).first()

#     eventos = []
#     for ag in agendamentos:
#         if not usuario_logado.is_external or ag.user_id == user_id:
#             label = f" {ag.user.full_name or ag.user.username}"
#         else:
#             label = "Horário Reservado"
            
#         eventos.append({
#             "id": ag.id,
#             "title": label,
#             "start": ag.start_time,
#             "end": ag.end_time,
#             "color": "#7f8c8d" if usuario_logado.is_external and ag.user_id != user_id else "#3498db"
#         })
#     return eventos

@router.get("/api/eventos/{equipment_id}", tags=["agendamentos"])
def listar_eventos(equipment_id: int, user_id: int, db: Session = Depends(database.get_db)):
    agendamentos = db.query(models.Schedule).filter(models.Schedule.equipment_id == equipment_id).all()
    # BUSCA AS MANUTENÇÕES TAMBÉM:
    manutencoes = db.query(models.equipment_maintenances).filter(models.equipment_maintenances.equipment_id == equipment_id).all()
    
    usuario_logado = db.query(models.User).filter(models.User.id == user_id).first()
    eventos = []

    # Adiciona agendamentos normais
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

    # ADICIONA AS MANUTENÇÕES COM COR DIFERENTE (VERMELHO)
    for mt in manutencoes:
        eventos.append({
            "id": f"maint_{mt.id}",
            "title": f"MANUTENÇÃO: {mt.description or ''}",
            "start": mt.start_time,
            "end": mt.end_time,
            "color": "#e74c3c", # Vermelho
            "rendering": "background"
        })

    return eventos