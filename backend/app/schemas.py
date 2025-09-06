from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class CodeSubmission(BaseModel):
    code: str
    language: str
    stdin: Optional[str] = None

class Job(BaseModel):
    id: str
    user_id: str
    status: str
    language: str
    code: str
    stdin: Optional[str] = None
    output: Optional[str] = None

class User(BaseModel):
    username: str

class UserCreate(User):
    password: str

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class CodeFileBase(BaseModel):
    filename: str
    language: str

class CodeFileCreate(CodeFileBase):
    code: str

class CodeFile(CodeFileBase):
    id: int
    owner_username: str
    created_at: datetime
    class Config:
        orm_mode = True

class SharedCodeFile(BaseModel):
    filename: str
    language: str
    code: str
    owner_username: str

    class Config:
        from_attributes = True