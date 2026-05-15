from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app import models, database, schemas
from app.auth import autenticar_e_obter_info
import datetime

router = APIRouter()


@router.post("/api/login-interno")
def login_interno(dados: schemas.LoginInternoRequest, db: Session = Depends(database.get_db)):
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


@router.post("/api/login-externo")
def login_externo(dados: schemas.LoginExternoRequest, db: Session = Depends(database.get_db)):
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

@router.get("/api/verificar-acesso/{user_id}")
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
