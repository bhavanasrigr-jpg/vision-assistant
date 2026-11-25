import base64
import binascii
import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.settings import get_settings

IMAGE_PATTERN = re.compile(r"^data:(image/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$")


class ImageRequest(BaseModel):
    image: str = Field(min_length=30)

    @field_validator("image")
    @classmethod
    def validate_image(cls, value: str) -> str:
        match = IMAGE_PATTERN.fullmatch(value)
        if not match:
            raise ValueError("Provide a base64-encoded JPEG, PNG, WebP, or GIF data URL.")
        try:
            decoded = base64.b64decode(match.group(2), validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("The image data is not valid base64.") from error
        if len(decoded) > get_settings().max_image_bytes:
            raise ValueError("Image exceeds the configured size limit.")
        return value


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question cannot be blank.")
        return value.strip()


class DescriptionResponse(BaseModel):
    result: str
    details: dict[str, Any]
    demo: bool = False


class Detection(BaseModel):
    name: str
    confidence: float | None = None


class DetectionResponse(BaseModel):
    detections: list[Detection]
    demo: bool = False


class AssistantResponse(BaseModel):
    answer: str
    demo: bool = False
