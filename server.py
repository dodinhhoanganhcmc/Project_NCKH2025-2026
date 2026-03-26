import os
import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import uvicorn

app = FastAPI(title="PhoBERT Toxic Filter API")

# Cấu hình CORS cho phép mọi request từ extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tự động lấy đường dẫn thư mục hiện tại để load mô hình
MODEL_PATH = os.path.dirname(os.path.abspath(__file__))

print("Đang nạp mô hình PhoBERT và Tokenizer...")
try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
    model.eval()
    print("Nạp mô hình thành công!")
except Exception as e:
    print(f"Lỗi khi nạp mô hình: {e}")

class TextRequest(BaseModel):
    texts: list[str]

class PredictionResponse(BaseModel):
    scores: list[float]
    is_toxic: list[bool]

THRESHOLD = 0.8

@app.post("/analyze", response_model=PredictionResponse)
async def analyze_texts(request: TextRequest):
    if not request.texts:
        return {"scores": [], "is_toxic": []}

    scores = []
    is_toxic_list = []

    try:
        with torch.no_grad():
            inputs = tokenizer(request.texts, padding=True, truncation=True, max_length=256, return_tensors="pt")
            outputs = model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=-1)
            
            # Giả định class 1 là Toxic (tiêu chuẩn cho các model classification binary)
            if probs.shape[1] > 1:
                toxic_probs = probs[:, 1].tolist()
            else:
                toxic_probs = probs[:, 0].tolist()
                
            for score in toxic_probs:
                scores.append(score)
                is_toxic_list.append(score > THRESHOLD)
    except Exception as e:
        print("Lỗi khi đánh giá:", e)
        # Fallback an toàn nếu có text rác làm crash
        scores = [0.0] * len(request.texts)
        is_toxic_list = [False] * len(request.texts)

    return {"scores": scores, "is_toxic": is_toxic_list}

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
