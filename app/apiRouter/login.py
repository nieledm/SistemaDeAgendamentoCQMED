from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app import models, database, schemas, auth
from app.database import get_db
from app.auth import criar_token_jwt, autenticar_e_obter_info
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import os

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/api/login-interno", tags=["Login"])
# def login_interno(dados: schemas.LoginInternoRequest, db: Session = Depends(database.get_db)):
#     # 1. Tenta autenticar no AD
#     info_ad = autenticar_e_obter_info(dados.username, dados.password)
    
#     if not info_ad:
#         raise HTTPException(status_code=401, detail="Credenciais do AD inválidas")

#     # 2. Sincroniza com o banco local
#     user = db.query(models.User).filter(models.User.username == dados.username).first()
    
#     # Determina se é admin
#     is_admin = False
#     for grupo in info_ad.get("grupos", []):
#         grupo_lower = grupo.lower()
#         if "adm" in grupo_lower:
#             is_admin = True
#             break
#     # if dados.username == "niele.mendes": is_admin = True
#     if dados.username == "gabriel.valderrama": is_admin = True

#     if not user:
#         user = models.User(
#             username=dados.username,
#             # full_name=info_ad["nome"],
#             full_name=info_ad.get("nome", dados.username),  # Fallback para o username
#             is_admin=is_admin,
#             is_external=False # Usuário AD nunca é externo
#         )
#         db.add(user)
#         db.commit()
#         db.refresh(user)
#     else:
#         # Atualiza o status de admin caso tenha mudado no AD
#         user.is_admin = is_admin
#         user.full_name = info_ad.get("nome", user.full_name)
#         db.commit()

#     return {
#         "status": "sucesso",
#         "user_id": user.id,
#         "username": user.username,
#         "is_admin": user.is_admin
#     }
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    auth_mode = os.getenv("AUTH_MODE", "LDAP").upper()
    
    # ---------------------------------------------------------
    # TRILHO 1: MODO LDAP
    # ---------------------------------------------------------
    if auth_mode == "LDAP":
        ldap_info = autenticar_e_obter_info(form_data.username, form_data.password)
        
        if ldap_info is None: # Trocado para is None
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Credenciais de rede inválidas"
            )
        
        user = db.query(models.User).filter(models.User.username == form_data.username).first()
        
        if user is None: # Trocado para is None
            user = models.User(
                username=form_data.username,
                full_name=ldap_info.get("nome", form_data.username),
                is_external=False,
                is_admin=("Admin_CQMED" in ldap_info.get("grupos", []))
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    # ---------------------------------------------------------
    # TRILHO 2: MODO LOCAL 
    # ---------------------------------------------------------
    elif auth_mode == "LOCAL":
        user = db.query(models.User).filter(models.User.username == form_data.username).first()
        
        # Trocado para is None
        if user is None or not pwd_context.verify(form_data.password, str(user.hashed_password)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Usuário ou senha inválidos"
            )
            
    # ---------------------------------------------------------
    # TRILHO DE ERRO
    # ---------------------------------------------------------
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Configuração de autenticação inválida no servidor."
        )

    # Gera o Token
    access_token = criar_token_jwt(data={"sub": user.username})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
        "is_external": user.is_external
    }

@router.post("/api/login-externo", tags=["Login"])
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

@router.get("/api/verificar-acesso/{user_id}", tags=["Login"])
def verificar_acesso(user_id: int, db: Session = Depends(database.get_db)):
    usuario = db.query(models.User).filter(models.User.id == user_id).first()
    
    # Ajustado para 'is None' para evitar o mesmo erro nesta linha
    if usuario is None: 
        raise HTTPException(status_code=401, detail="Usuário não encontrado. Por favor, faça login novamente.")

    # Regra de bloqueio para usuários externos (Pendente ou Expirado)
    if usuario.is_external is True: # O VS Code entende 'is True' perfeitamente
        if usuario.expiration_date is None: # Trocado 'not' por 'is None'
            raise HTTPException(
                status_code=403, 
                detail="Acesso bloqueado. Seu status está pendente de liberação pelo administrador."
            )
            
        # O '# type: ignore' avisa o VS Code que nós sabemos o que estamos fazendo com essa data
        if usuario.expiration_date < datetime.utcnow():  # type: ignore
            raise HTTPException(
                status_code=403, 
                detail=f"Acesso expirado. Sua validade encerrou em {usuario.expiration_date.strftime('%d/%m/%Y')}."
            )

    return {"status": "autorizado"}

@router.post("/api/debug/ldap", tags=["Login", "Debug"])
def debug_ldap(dados: schemas.LoginInternoRequest):
    """
    ROTA TEMPORÁRIA PARA DEBUG: 
    Testa a conexão com o AD e retorna os dados brutos.
    """
    # Tenta autenticar no AD usando a sua função
    info_ad = autenticar_e_obter_info(dados.username, dados.password)
    
    if not info_ad:
        raise HTTPException(status_code=401, detail="Credenciais inválidas no AD")

    # Retorna o dicionário EXATAMENTE como a função entregou
    return {
        "status": "sucesso",
        "mensagem": "Estes são os dados puros retornados pelo AD:",
        "dados_brutos": info_ad
    }