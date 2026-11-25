import httpx
from fastapi import HTTPException

from app.settings import get_settings


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.vision_api_key.strip() and settings.vision_model.strip())


async def complete(messages: list[dict]) -> str:
    settings = get_settings()
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Set VISION_API_KEY and VISION_MODEL in the backend environment.",
        )
    url = f"{settings.vision_api_url.rstrip('/')}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.vision_api_key}"},
                json={"model": settings.vision_model, "messages": messages, "temperature": 0.2},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as error:
        raise HTTPException(status_code=504, detail="The AI service timed out. Please try again.") from error
    except httpx.HTTPStatusError as error:
        raise HTTPException(
            status_code=502,
            detail=f"The AI service returned status {error.response.status_code}. Check backend configuration and try again.",
        ) from error
    except (httpx.RequestError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Could not get a valid response from the AI service.") from error

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise HTTPException(status_code=502, detail="The AI service response had an unexpected format.") from error
    if isinstance(content, list):
        content = "\n".join(
            item.get("text", "") for item in content if isinstance(item, dict)
        )
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=502, detail="The AI service returned an empty response.")
    return content.strip()
