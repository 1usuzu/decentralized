"""
Backend API - Deepfake Verification System
"""

import sys
import os
from pathlib import Path
from contextlib import asynccontextmanager

# Add ai_deepfake to path for import
_ai_path = Path(__file__).parent.parent / "ai_deepfake"
if _ai_path.exists():
    sys.path.insert(0, str(_ai_path))

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import hashlib
import tempfile
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

from detect import DeepfakeDetector

detector = None

# Oracle signer private key (load from environment in production!)
ORACLE_PRIVATE_KEY = os.getenv("ORACLE_PRIVATE_KEY", "0x0000000000000000000000000000000000000000000000000000000000000001")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MAGIC_BYTES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    b'RIFF': 'image/webp',
}


def sign_verification_result(image_hash_hex: str, is_real: bool, confidence: int) -> str:
    """Sign verification result with Oracle private key"""
    # Convert to bytes32 format
    image_hash_bytes = bytes.fromhex(image_hash_hex)
    
    # Create message hash matching contract's keccak256(abi.encodePacked(...))
    message_hash = Web3.solidity_keccak(
        ['bytes32', 'bool', 'uint256'],
        [image_hash_bytes, is_real, confidence]
    )
    
    # Sign the message
    message = encode_defunct(message_hash)
    signed = Account.sign_message(message, private_key=ORACLE_PRIVATE_KEY)
    
    return signed.signature.hex()


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


app = FastAPI(
    title="Deepfake Verification API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "Deepfake Verification API",
        "version": "1.0.0"
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "detector_ready": detector is not None
    }


@app.post("/api/verify")
async def verify_image(file: UploadFile = File(...)):
    """Verify if an image is real or deepfake"""
    
    if detector is None:
        raise HTTPException(status_code=503, detail="AI Detector not initialized")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    temp_file = None
    try:
        content = await file.read()
        
        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB")
        
        # Validate magic bytes
        is_valid_image = any(content.startswith(magic) for magic in ALLOWED_MAGIC_BYTES.keys())
        if not is_valid_image:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        suffix = Path(file.filename).suffix or ".jpg"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.write(content)
        temp_file.close()
        
        image_hash = hashlib.sha256(content).hexdigest()
        result = detector.predict(temp_file.name)
        
        # Create signature for blockchain verification
        is_real = result["label"] == "REAL"
        confidence_int = int(result["confidence"] * 10000)  # Convert to contract format
        
        signature = sign_verification_result(image_hash, is_real, confidence_int)
        
        return {
            "label": result["label"],
            "confidence": result["confidence"],
            "real_prob": result["real_prob"],
            "fake_prob": result["fake_prob"],
            "image_hash": image_hash,
            "image_hash_bytes32": "0x" + image_hash,  # For contract
            "confidence_int": confidence_int,  # For contract
            "signature": "0x" + signature,  # Oracle signature for contract
            "filename": file.filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)


@app.post("/api/batch-verify")
async def batch_verify(files: list[UploadFile] = File(...)):
    """Verify multiple images"""
    
    if detector is None:
        raise HTTPException(status_code=503, detail="AI Detector not initialized")
    
    results = []
    
    for file in files:
        if not file.content_type.startswith("image/"):
            results.append({"filename": file.filename, "error": "Not an image"})
            continue
        
        temp_file = None
        try:
            suffix = Path(file.filename).suffix or ".jpg"
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            
            content = await file.read()
            temp_file.write(content)
            temp_file.close()
            
            result = detector.predict(temp_file.name)
            results.append({
                "filename": file.filename,
                "label": result["label"],
                "confidence": result["confidence"],
                "real_prob": result["real_prob"],
                "fake_prob": result["fake_prob"],
                "image_hash": hashlib.sha256(content).hexdigest()
            })
            
        except Exception as e:
            results.append({"filename": file.filename, "error": str(e)})
            
        finally:
            if temp_file and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
    
    successful = [r for r in results if "error" not in r]
    
    return {
        "total": len(results),
        "successful": len(successful),
        "real_count": sum(1 for r in successful if r["label"] == "REAL"),
        "fake_count": sum(1 for r in successful if r["label"] == "FAKE"),
        "results": results
    }


if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000)
