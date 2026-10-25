from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool, field_validator


class EmailInput(BaseModel):
    email: EmailStr = Field(max_length=255)

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LoginInput(EmailInput):
    password: str = Field(min_length=1, max_length=128)


class RegisterInput(LoginInput):
    name: str = Field(min_length=1, max_length=100)
    name_is_public: StrictBool = False

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("ユーザー名を入力してください")
        return value.strip()


class TokenInput(BaseModel):
    token: str = Field(min_length=32, max_length=256)


class ResetInput(TokenInput):
    password: str = Field(min_length=12, max_length=128)


class RefreshInput(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=32, max_length=256)


class UserOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class TokenOutput(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: UserOutput
