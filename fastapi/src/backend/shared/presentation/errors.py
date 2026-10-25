from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def install_error_mapping(
    app: FastAPI, base: type[Exception], mappings: tuple[tuple[type[Exception], int], ...]
) -> None:
    async def handler(request: Request, error: Exception) -> JSONResponse:
        status = next((code for kind, code in mappings if isinstance(error, kind)), 500)
        return JSONResponse(status_code=status, content={"detail": str(error)})

    app.add_exception_handler(base, handler)
