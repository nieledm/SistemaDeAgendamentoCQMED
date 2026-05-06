from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) # ID do AD ou e-mail
    full_name = Column(String)
    is_external = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    expiration_date = Column(DateTime, nullable=True)

class Equipment(Base):
    __tablename__ = "equipments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    responsible_id = Column(Integer, ForeignKey("users.id"))
    responsible = relationship("User")

class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    equipment_id = Column(Integer, ForeignKey("equipments.id"))
    granted_at = Column(DateTime, default=datetime.datetime.utcnow)
    expiration_date = Column(DateTime, nullable=True)
    user = relationship("User") 
    equipment = relationship("Equipment") 

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipments.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User") 
    equipment = relationship("Equipment")
