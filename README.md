# DeepfakeVerify - Hệ thống Định danh Phi tập trung với AI Phát hiện Deepfake

> Đồ án tốt nghiệp: Hệ thống định danh phi tập trung tích hợp AI phát hiện Deepfake và xác thực không kiến thức

## Giới thiệu

Hệ thống kết hợp 3 công nghệ chính:

- **AI Deepfake Detection**: Phát hiện ảnh giả mạo sử dụng EfficientNet-B0
- **Decentralized Identity (DID)**: Định danh phi tập trung theo chuẩn W3C
- **Blockchain**: Lưu trữ kết quả xác thực bất biến trên smart contract

## Tính năng

- ✅ Phát hiện ảnh Deepfake với độ chính xác 93.33%
- ✅ Tạo và quản lý DID (Decentralized Identifier)
- ✅ Cấp Verifiable Credentials cho kết quả xác thực
- ✅ Lưu trữ kết quả lên blockchain (Polygon)
- ✅ Giao diện web thân thiện với drag & drop

## Công nghệ sử dụng

| Layer      | Công nghệ                                     |
| ---------- | --------------------------------------------- |
| AI Model   | PyTorch, EfficientNet-B0, Temperature Scaling |
| Backend    | FastAPI, Uvicorn, Python 3.11                 |
| Frontend   | React 19, Vite, ethers.js                     |
| Blockchain | Solidity, Hardhat, Polygon Amoy               |
| DID        | W3C DID Core, Ed25519, Verifiable Credentials |

## Cấu trúc dự án

```
├── ai_deepfake/           # AI Deepfake Detection
│   ├── detect.py          # Inference module
│   ├── train.py           # Training script
│   ├── test_model.py      # Evaluation
│   └── models/            # Trained models
├── backend/               # FastAPI Backend
│   └── api.py             # REST API server
├── blockchain/            # Smart Contracts
│   ├── contracts/         # Solidity contracts
│   └── scripts/           # Deploy scripts
├── did_system/            # DID & Verifiable Credentials
│   ├── did_manager.py     # DID creation
│   └── credential_issuer.py # VC issuance
└── frontend/              # React Frontend
    └── src/               # React components
```

## Cài đặt

### Yêu cầu

- Python 3.11+
- Node.js 18+
- CUDA (optional, for GPU)

### Backend

```bash
# Tạo virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows

# Cài đặt dependencies
pip install torch torchvision fastapi uvicorn python-multipart pillow cryptography base58

# Chạy server
cd backend
uvicorn api:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Blockchain

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

## API Endpoints

| Method | Endpoint            | Mô tả                 |
| ------ | ------------------- | --------------------- |
| POST   | `/api/verify`       | Xác thực ảnh deepfake |
| POST   | `/api/batch-verify` | Xác thực nhiều ảnh    |
| GET    | `/api/health`       | Health check          |

### Ví dụ request

```bash
curl -X POST "http://localhost:8000/api/verify" \
  -F "file=@image.jpg"
```

### Response

```json
{
  "label": "REAL",
  "confidence": 0.92,
  "real_prob": 0.92,
  "fake_prob": 0.08,
  "image_hash": "sha256:..."
}
```

## Kết quả AI Model

| Metric        | Giá trị                          |
| ------------- | -------------------------------- |
| Test Accuracy | 93.33%                           |
| Model         | EfficientNet-B0                  |
| Temperature   | 3.5                              |
| Dataset       | 6000 images (50% real, 50% fake) |

## Smart Contract

Contract `DeepfakeVerification.sol` hỗ trợ:

- Đăng ký DID
- Lưu kết quả xác thực
- Truy vấn lịch sử xác thực

## Tác giả

Đồ án tốt nghiệp - 2025

## License

MIT License
