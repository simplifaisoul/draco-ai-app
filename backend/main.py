from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="Draco AI Backend", version="2.0.0")

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "openai"

@app.get("/")
async def health_check():
    return {"status": "healthy", "service": "draco-ai-backend"}

@app.post("/chat/completions")
async def chat_completions(request: ChatRequest):
    # This is a placeholder for where robust backend orchestration would happen.
    # For now, the frontend hits Pollinations.ai directly for speed/free access,
    # but this endpoint is ready for future proxying, logging, or custom model handling.
    return {
        "status": "received",
        "model": request.model,
        "message": "Backend proxy ready. Frontend currently optimized for direct client-side calls."
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
