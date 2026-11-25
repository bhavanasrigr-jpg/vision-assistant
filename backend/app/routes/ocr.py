from fastapi import APIRouter, HTTPException

from app.schemas import ImageRequest

router = APIRouter(prefix="/api/ocr", tags=["ocr"])


@router.post("/read")
async def read_text(request: ImageRequest) -> None:
    del request
    raise HTTPException(
        status_code=501,
        detail="Server-side OCR is not configured. The Vision Assistant frontend performs OCR locally in your browser.",
    )
