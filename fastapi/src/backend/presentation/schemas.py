from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    name: str
    email: str


class UserUpdate(BaseModel):
    name: str
    email: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class BookCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    book_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    author: str | None = Field(default=None, max_length=255)
    total_pages: int = Field(ge=1, le=1_000_000)


class BookResponse(BaseModel):
    id: int
    title: str
    author: str | None
    total_pages: int
    created_at: datetime


class BookListResponse(BaseModel):
    items: list[BookResponse]
    limit: int
    offset: int


class ReviewSave(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    review_text: str = Field(min_length=1, max_length=140)


class PageReviewResponse(BaseModel):
    id: int
    book_id: int
    page_number: int
    review_text: str
    color_code: str
    created_at: datetime
    updated_at: datetime
