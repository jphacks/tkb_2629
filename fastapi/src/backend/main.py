import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .domain.errors import Conflict, DomainError, ExternalServiceError, InvalidInput, NotFound
from .presentation.routes import catalog, reading, users


def create_app() -> FastAPI:
    app = FastAPI()
    origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8081,http://localhost:19006",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, error: DomainError) -> JSONResponse:
        status_code = 500
        if type(error) is NotFound:
            status_code = 404
        elif type(error) is Conflict:
            status_code = 409
        elif type(error) is InvalidInput:
            status_code = 422
        elif type(error) is ExternalServiceError:
            status_code = 502
        return JSONResponse(status_code=status_code, content={"detail": str(error)})

    app.include_router(catalog)
    app.include_router(users)
    app.include_router(reading)
    return app


app = create_app()
