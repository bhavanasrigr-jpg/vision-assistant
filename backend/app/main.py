from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import assistant, ocr, vision
from app.services.model_client import is_configured
from app.settings import get_settings

settings = get_settings()
app = FastAPI(title="Vision Assistant API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(vision.router)
app.include_router(ocr.router)
app.include_router(assistant.router)


@app.get("/api/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "ai_configured": is_configured(), "ocr_mode": "browser"}
