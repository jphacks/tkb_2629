from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from .database import Base, engine, get_db
from .models import User
from .schemas import UserCreate, UserResponse, UserUpdate

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine) # 本番ではAlembicに置き換える
    yield

app = FastAPI(lifespan=lifespan)

DbSession = Annotated[Session, Depends(get_db)]

@app.post("/users", response_model=UserResponse)
def create_user(
    request: UserCreate,
    db: DbSession,
):
    user = User(
        name=request.name,
        email=request.email,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user

@app.get("/users", response_model=list[UserResponse])
def get_users(db: DbSession):
    statement = select(User)

    users = db.scalars(statement).all()

    return users

@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user

@app.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    request: UserUpdate,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.name = request.name
    user.email = request.email

    db.commit()
    db.refresh(user)

    return user

@app.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    db.delete(user)
    db.commit()