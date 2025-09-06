from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, security, models
from ..database import get_db
import shortuuid
router = APIRouter(prefix="/files", tags=["Files"])

@router.post("", response_model=schemas.CodeFile)
async def save_code_file(file_data: schemas.CodeFileCreate, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    db_file = db.query(models.CodeFile).filter(
        models.CodeFile.owner_username == current_user.username,
        models.CodeFile.filename == file_data.filename,
        models.CodeFile.language == file_data.language
    ).first()
    if db_file:
        raise HTTPException(status_code=400, detail="A file with this name and language already exists.")
    new_file = models.CodeFile(**file_data.dict(), owner_username=current_user.username)
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    return new_file

@router.get("", response_model=List[schemas.CodeFile])
async def get_saved_files(db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    return db.query(models.CodeFile).filter(models.CodeFile.owner_username == current_user.username).all()

@router.get("/{file_id}", response_model=schemas.CodeFileCreate)
async def get_file_content(file_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    db_file = db.query(models.CodeFile).filter(models.CodeFile.id == file_id).first()
    if not db_file or db_file.owner_username != current_user.username:
        raise HTTPException(status_code=404, detail="File not found.")
    return schemas.CodeFileCreate(filename=db_file.filename, language=db_file.language, code=db_file.code)

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_file(file_id: int, db: Session = Depends(get_db), current_user: schemas.User = Depends(security.get_current_user)):
    db_file = db.query(models.CodeFile).filter(models.CodeFile.id == file_id).first()
    if not db_file or db_file.owner_username != current_user.username:
        raise HTTPException(status_code=404, detail="File not found.")
    db.delete(db_file)
    db.commit()
    return

@router.post("/share/{file_id}")
def share_codefile(file_id: int, db: Session = Depends(get_db), user: schemas.User = Depends(security.get_current_user)):
    file = db.query(models.CodeFile).filter(models.CodeFile.id == file_id).first()
    if not file:
        raise HTTPException(404, "File not found")
    
    if not file.share_id:
        file.share_id = shortuuid.uuid()[:8]  # generate 8-char share ID
        db.commit()
        db.refresh(file)
    
    share_url = f"http://localhost:3000/files/shared/{file.share_id}"
    return {"share_url": share_url}

@router.get("/{share_id}", response_model=schemas.SharedCodeFile)
def get_shared_code(share_id: str, db: Session = Depends(get_db), user: schemas.User = Depends(security.get_current_user)):
    file = db.query(models.CodeFile).filter(models.CodeFile.share_id == share_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Shared file not found")
    return file

