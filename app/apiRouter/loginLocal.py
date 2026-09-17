from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import os
from typing import Optional, List
from passlib.context import CryptContext
from app.database import get_db
from app import models
from app import schemas

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Modelo de dados que o frontend vai enviar
class UsuarioCreate(BaseModel):
    username: str
    full_name: str
    password: str
    is_admin: bool = False
    expiration_date: Optional[datetime] = None

# @router.post("/", tags=["Gestão de Usuários Login Local"])
# def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
#     # Trava de Segurança 1: Só permite se for modo LOCAL
#     if os.getenv("AUTH_MODE", "LDAP").upper() != "LOCAL":
#         raise HTTPException(status_code=403, detail="Gestão manual desabilitada. O sistema está usando LDAP.")

#     # Trava de Segurança 2: Verifica se o login já existe
#     usuario_existente = db.query(models.User).filter(models.User.username == usuario.username).first()
#     if usuario_existente is not None:
#         raise HTTPException(status_code=400, detail="Este nome de usuário já está em uso.")

#     # Cria o usuário com a senha criptografada
#     novo_usuario = models.User(
#         username=usuario.username,
#         full_name=usuario.full_name,
#         hashed_password=pwd_context.hash(usuario.password),
#         is_admin=usuario.is_admin,
#         expiration_date=usuario.expiration_date,
#         is_active=True
#     )
#     db.add(novo_usuario)
#     db.commit()
    
#     return {"mensagem": "Usuário criado com sucesso!"}

@router.patch("/api/local/{user_id}/status", tags=["Gestão de Usuários Login Local"])
def alternar_status_usuario(user_id: int, ativo: bool, db: Session = Depends(get_db)):
    # Rota para o Admin "Desativar" ou "Reativar" um usuário
    usuario = db.query(models.User).filter(models.User.id == user_id).first()
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    usuario.is_active = ativo
    db.commit()
    status_str = "ativado" if ativo else "desativado"
    return {"mensagem": f"Usuário {status_str} com sucesso."}

@router.delete("/api/local/{user_id}", tags=["Gestão de Usuários Login Local"])
def excluir_usuario(user_id: int, db: Session = Depends(get_db)):
    usuario = db.query(models.User).filter(models.User.id == user_id).first()
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    db.delete(usuario)
    db.commit()
    return {"mensagem": "Usuário excluído permanentemente."}

#########################################################################################
# Registros de usuários locais e externo para software configurado para acesso sem LDAP #
#########################################################################################

# 1. O "Formulário" que o frontend vai enviar
class RegistroRequest(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    is_external: bool

# 2. A Rota Pública de Cadastro
@router.post("/api/local/registro", tags=["Autenticação Local"])
def auto_cadastro(form: RegistroRequest, db: Session = Depends(get_db)):
    
    # Se for utilizador externo, forçamos o username a ser igual ao e-mail
    # Isso evita que o parceiro externo tenha de inventar um utilizador e um e-mail diferentes
    final_username = form.email if form.is_external else form.username

    # Validação de Segurança: Verifica se o e-mail ou o utilizador já existem no banco
    usuario_existente = db.query(models.User).filter(
        or_(
            models.User.username == final_username,
            models.User.email == form.email
        )
    ).first()
    
    if usuario_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Este utilizador ou e-mail já se encontra registado no sistema."
        )

    # Cria o novo registo na base de dados
    novo_usuario = models.User(
        username=final_username,
        email=form.email,
        full_name=form.full_name,
        hashed_password=pwd_context.hash(form.password),
        is_external=form.is_external,
        is_admin=False,  # Por segurança, ninguém nasce como Administrador
        is_active=False  # Nasce bloqueado, aguardando que o Admin ative e dê a validade
    )
    
    db.add(novo_usuario)
    db.commit()
    
    return {
        "mensagem": "Registo realizado com sucesso! A sua conta foi encaminhada para aprovação do administrador."
    }


###################################################################################
# Rotas de Gestão do Administrador para os registos de usuários locais e externos #
###################################################################################

# 1. Modelos de Validação (Pydantic)
class UsuarioResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_external: bool
    is_active: bool
    expiration_date: Optional[datetime]
    is_admin: bool
    class Config:
        from_attributes = True

class DecisaoAprovacao(BaseModel):
    aprovar: bool
    expiration_date: Optional[datetime] = None # Opcional: Se omitido, o acesso é vitalício

# ----- USUÁRIOS INTERNOS (LOCAIS) -----

# listar usuários internos (sem LDAP) - para fins de monitorização e gestão
@router.get("/api/local/usuarios-internos", response_model=List[UsuarioResponse], tags=["Gestão Local"])
def listar_usuarios_internos(db: Session = Depends(get_db)):
    # Trava de segurança: Se não for modo LOCAL, a gestão é feita pelo Active Directory
    if os.getenv("AUTH_MODE", "LDAP").upper() != "LOCAL":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Modo LDAP ativo. A gestão de utilizadores é feita no Active Directory."
        )
# models.User.is_active == False,
# models.User.expiration_date < datetime.utcnow()
    usuarios = db.query(models.User).filter(
        models.User.is_external == False, 
        models.User.is_active == True,
        or_(
            models.User.expiration_date >= datetime.utcnow(),
            models.User.expiration_date == None
        ) 
        
        ).all()
    return usuarios

@router.post("/api/local/usuarios-internos", tags=["Gestão Local"])
def configurar_usuario_interno(dados: schemas.UsuarioInternoConfig, db: Session = Depends(get_db)):
    if os.getenv("AUTH_MODE", "LDAP").upper() != "LOCAL":
        raise HTTPException(status_code=403, detail="Modo LDAP ativo.")

    user = db.query(models.User).filter(
        models.User.username == dados.username, 
        models.User.is_external == False
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário interno não encontrado")
    
    # Extrai APENAS os campos que o frontend efetivamente mandou no JSON
    # Se você usar Pydantic v2, troque .dict() por .model_dump(exclude_unset=True)
    update_data = dados.dict(exclude_unset=True)
    
    # Atualiza a data se ela foi enviada (mesmo que tenha sido enviada como null/None propositalmente)
    if "expiration_date" in update_data:
        user.expiration_date = update_data["expiration_date"]
        
    if "is_admin" in update_data:
        user.is_admin = update_data["is_admin"]
        
    if "is_active" in update_data:
        user.is_active = update_data["is_active"]
        
    db.commit()
    
    return {"message": "Configurações do usuário atualizadas"}
@router.delete("/api/local/usuarios-internos/{user_id}", tags=["Gestão Local"])
def deletar_usuario_interno(user_id: int, db: Session = Depends(get_db)):
    if os.getenv("AUTH_MODE", "LDAP").upper() != "LOCAL":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Modo LDAP ativo."
        )

    user = db.query(models.User).filter(
        models.User.id == user_id, 
        models.User.is_external == False
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário interno não encontrado")
    
    db.delete(user)
    db.commit()
    
    return {"message": "Usuário excluído com sucesso"}


# ----- USUÁRIOS EXTERNOS -----
#  Rotas reaproveitadas do login local para gestão de usuários externos
# -> Deletar usuário (/api/admin/usuario-externo/{user_id})
# -> Listar usuários externos (/api/admin/usuarios-externos)
# -> Configurar usuário externo (/api/admin/usuarios-externos)
# -> Rota de ativação/desativação (/api/admin/status)

# ----- USUÁRIOS PENDENTES -----
# Rotas reaproveitadas do login local para gestão de usuários pendentes
# -> Rota de ativação/desativação (/api/admin/status)
# -> Rota de exclusão (/api/admin/usuarios-pendentes/{user_id})

@router.get("/api/local/usuarios-pendentes", response_model=List[UsuarioResponse], tags=["Gestão Local"])
def listar_usuarios_pendentes(db: Session = Depends(get_db)):
    # Trava de segurança: Se não for modo LOCAL, a gestão é feita pelo Active Directory
    if os.getenv("AUTH_MODE", "LDAP").upper() != "LOCAL":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Modo LDAP ativo. A gestão de utilizadores é feita no Active Directory."
        )

    # Busca usuários onde (is_active é Falso) OU (a data de expiração existe e já passou)
    usuarios_pendentes = db.query(models.User).filter(
        or_(
            models.User.is_active == False,
            models.User.expiration_date < datetime.utcnow()
        )
    ).all()
    return usuarios_pendentes


@router.delete("/api/local/usuario-pendente/{user_id}", tags=["Admin-Usuários_Externos"])
def remover_usuario_externo(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.is_external == True).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuário externo não encontrado")
    
    db.delete(user)
    db.commit()
    
    return {"message": "Usuário excluído com sucesso"}

@router.get("/api/local/ativos", response_model=List[UsuarioResponse], tags=["Gestão Local"])
def listar_usuarios_ativos(db: Session = Depends(get_db)):
    usuarios_ativos = db.query(models.User).filter(models.User.is_active == True).all()
    return usuarios_ativos

