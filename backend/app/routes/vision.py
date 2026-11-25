import json

from fastapi import APIRouter

from app.schemas import Detection, DetectionResponse, DescriptionResponse, ImageRequest
from app.services.model_client import complete

router = APIRouter(prefix="/api/vision", tags=["vision"])


@router.post("/describe", response_model=DescriptionResponse)
async def describe_scene(request: ImageRequest) -> DescriptionResponse:
    text = await complete(
        [
            {
                "role": "system",
                "content": (
                    "Describe the provided image clearly and concisely for a person with low vision. "
                    "Use only visible evidence. Do not infer safety, identity, or unsupported spatial relationships. "
                    "Mention uncertainty. Return a JSON object with string fields overall, objects (array of strings), "
                    "importantDetails, text, spatial, uncertainty."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image for accessibility."},
                    {"type": "image_url", "image_url": {"url": request.image, "detail": "high"}},
                ],
            },
        ]
    )
    try:
        details = json.loads(text)
        if not isinstance(details, dict):
            raise ValueError("Expected object")
        result = str(details.get("overall") or text)
    except (json.JSONDecodeError, ValueError):
        details = {
            "overall": text,
            "objects": [],
            "importantDetails": "See the overall description.",
            "text": "Text was not separately extracted.",
            "spatial": "No spatial relationships are asserted.",
            "uncertainty": "Descriptions can be incomplete. Do not rely on this result for safety-critical decisions.",
        }
        result = text
    return DescriptionResponse(result=result, details=details)


@router.post("/detect", response_model=DetectionResponse)
async def detect_objects(request: ImageRequest) -> DetectionResponse:
    text = await complete(
        [
            {
                "role": "system",
                "content": (
                    "Identify distinct visible object categories in this image. Return only a JSON array of objects "
                    "with name and confidence fields. Confidence must be a number from 0 to 1 only when the model "
                    "can provide a calibrated score; otherwise use null. Do not invent bounding boxes or claim certainty."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "List visible objects."},
                    {"type": "image_url", "image_url": {"url": request.image, "detail": "high"}},
                ],
            },
        ]
    )
    try:
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            raise ValueError("Expected array")
        detections = [
            Detection(
                name=str(item["name"])[:180],
                confidence=item.get("confidence") if isinstance(item.get("confidence"), (int, float)) else None,
            )
            for item in parsed
            if isinstance(item, dict) and item.get("name")
        ]
    except (json.JSONDecodeError, ValueError, TypeError):
        detections = [Detection(name=text[:500])]
    return DetectionResponse(detections=detections)
