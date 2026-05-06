# app/script.py
from app import models, database

db = next(database.get_db())

# 1. Renomeia o atual 'AKTA' para 'AKTA 1'
akta1 = db.query(models.Equipment).filter(models.Equipment.name == "AKTA").first()
if akta1:
    akta1.name = "AKTA 1"
    print("AKTA renomeado para AKTA 1")

# 2. Adiciona o 'AKTA 2' se ele ainda não existir
akta2_existe = db.query(models.Equipment).filter(models.Equipment.name == "AKTA 2").first()
if not akta2_existe:
    akta2 = models.Equipment(
        name="AKTA 2", 
        description="Equipamento de Purificação de Proteínas (Coluna 2)"
    )
    db.add(akta2)
    db.commit()
    print("AKTA 2 adicionado com sucesso")
else:
    print("AKTA 2 já existe no banco de dados")