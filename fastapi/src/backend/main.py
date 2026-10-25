import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .analysis.presentation.http import install_http as install_analysis_http
from .composition import schema as schema_registry  # noqa: F401
from .composition.identity import configure_identity
from .composition.reading import configure_reading_contexts
from .identity.presentation.http import install_identity_http
from .identity.presentation.profiles import router as users_router
from .identity.presentation.routes import router as auth_router
from .library.presentation.http import install_http as install_library_http
from .library.presentation.routes import router as library_router
from .reviews.presentation.http import install_http as install_reviews_http
from .reviews.presentation.routes import router as reviews_router
from .shared.application.security import AuthenticationRequired, AuthenticationUnavailable


def create_app() -> FastAPI:
    app = FastAPI()
    origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:8081,http://localhost:19006"
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AuthenticationRequired)
    async def authentication_required(
        request: Request, error: AuthenticationRequired
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"detail": str(error)},
            headers={"WWW-Authenticate": "Bearer", "Cache-Control": "no-store"},
        )

    @app.exception_handler(AuthenticationUnavailable)
    async def authentication_unavailable(
        request: Request, error: AuthenticationUnavailable
    ) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(error)})

    configure_identity(app)
    configure_reading_contexts(app)
    install_identity_http(app, origins)
    install_library_http(app)
    install_reviews_http(app)
    install_analysis_http(app)
    for router in (auth_router, users_router, library_router, reviews_router):
        app.include_router(router)
    return app


app = create_app()
