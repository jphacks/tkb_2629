from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .domain.errors import Conflict, DomainError, InvalidInput, NotFound
from .presentation.routes import catalog, reading, users


def create_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, error: DomainError) -> JSONResponse:
        status_code = 500
        if type(error) is NotFound:
            status_code = 404
        elif type(error) is Conflict:
            status_code = 409
        elif type(error) is InvalidInput:
            status_code = 422
        return JSONResponse(status_code=status_code, content={"detail": str(error)})

    app.include_router(catalog)
    app.include_router(users)
    app.include_router(reading)
    return app


app = create_app()
