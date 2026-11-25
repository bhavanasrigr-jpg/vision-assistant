from fastapi import APIRouter

from app.schemas import AssistantRequest, AssistantResponse
from app.services.model_client import complete

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/ask", response_model=AssistantResponse)
async def ask_assistant(request: AssistantRequest) -> AssistantResponse:
    answer = await complete(
        [
            {
                "role": "system",
                "content": (
                    "You are a concise, respectful accessibility assistant. Be transparent about uncertainty, "
                    "do not claim to see surroundings unless image input was provided, and never guarantee safety."
                ),
            },
            {"role": "user", "content": request.question},
        ]
    )
    return AssistantResponse(answer=answer)
