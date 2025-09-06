from sqlalchemy import Column, Integer, String, Text, DateTime,UniqueConstraint
from sqlalchemy.sql import func
from .database import Base


class CodeFile(Base):
    __tablename__ = "code_files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, nullable=False)
    language = Column(String, index=True, nullable=False)
    code = Column(Text, nullable=False)
    owner_username = Column(String, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    share_id = Column(String, unique=True, index=True, nullable=True)
    
    __table_args__ = (
        UniqueConstraint("owner_username", "filename", name="uq_user_filename"),
    )
    
    
    
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
