import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

# Add ai_deepfake to path for import
_ai_path = Path(__file__).parent.parent / "ai_deepfake"
if _ai_path.exists():
    sys.path.insert(0, str(_ai_path))

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from eth_account import Account
from eth_account.messages import encode_defunct
import uvicorn
import hashlib
import tempfile

from detect import DeepfakeDetector

# --- CẤU HÌNH BẢO MẬT (PRIVATE KEY) ---
# Lấy từ biến môi trường. Nếu không có, dùng Hardhat Account #0 (chỉ dùng cho dev)
SERVER_PRIVATE_KEY = os.environ.get(
    "SERVER_PRIVATE_KEY", 
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
) 

detector = None
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector
    print("Starting Deepfake Verification API...")
    model_path = Path(__file__).parent.parent / "ai_deepfake" / "models" / "best_model.pth"
    if model_path.exists():
        detector = DeepfakeDetector(model_path=str(model_path))
        print("AI Detector initialized")
    else:
        print(f"Model not found at {model_path}")
    yield
    print("Shutting down...")

app = FastAPI(title="Deepfake Verification API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/verify")
async def verify_image(
    file: UploadFile = File(...),
    user_address: str = Form(...)  # <--- BẮT BUỘC: Địa chỉ ví người dùng để ký
):
    """Verify if an image is real or deepfake and return a signed result"""
    
    if detector is None:
        raise HTTPException(status_code=503, detail="AI Detector not initialized")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    temp_file = None
    try:
        content = await file.read()
        
        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        suffix = Path(file.filename).suffix or ".jpg"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.write(content)
        temp_file.close()
        
        # 1. AI Dự đoán
        image_hash = hashlib.sha256(content).hexdigest()
        result = detector.predict(temp_file.name)
        
        # 2. Logic Ký số (Signing)
        # Tạo chuỗi thông điệp duy nhất để ký: "UserAddress:ImageHash:IsReal"
        is_real_str = "true" if result["label"] == "REAL" else "false"
        msg_content = f"{user_address.lower()}:{image_hash}:{is_real_str}"        
        # Hash và Ký
        message = encode_defunct(text=msg_content)
        signed_message = Account.sign_message(message, private_key=SERVER_PRIVATE_KEY)
        signature = signed_message.signature.hex()
        
        return {
            "label": result["label"],
            "confidence": result["confidence"],
            "real_prob": result["real_prob"],
            "fake_prob": result["fake_prob"],
            "image_hash": image_hash,
            "filename": file.filename,
            "signature": signature,   # <--- TRẢ VỀ CHỮ KÝ CHO FRONTEND
            "debug_msg": msg_content
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000)