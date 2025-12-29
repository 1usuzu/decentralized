import { useState } from 'react'
import { ethers } from 'ethers'
import WalletConnect from './components/WalletConnect'
import ImageUpload from './components/ImageUpload'
import VerificationResult from './components/VerificationResult'
import './App.css'

// ABI đã cập nhật hàm recordVerification mới
const CONTRACT_ABI = [
  "function registerDID(string calldata _did, string calldata _publicKeyBase58) external",
  "function recordVerification(bytes32 _imageHash, bool _isReal, uint256 _confidence, bytes calldata _signature) external",
  "function getVerification(bytes32 _imageHash) external view returns (tuple(bytes32 imageHash, string subjectDid, string issuerDid, bool isReal, uint256 confidence, uint256 timestamp, bytes32 credentialHash))",
  "function didDocuments(address) external view returns (address owner, string did, string publicKeyBase58, bool isActive, uint256 createdAt, uint256 updatedAt)",
  "function getStats() external view returns (uint256, uint256)"
];

// LƯU Ý: SAU KHI DEPLOY LẠI CONTRACT, HÃY CẬP NHẬT ĐỊA CHỈ MỚI VÀO ĐÂY
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x_DIA_CHI_CONTRACT_MOI_CUA_BAN";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [userDID, setUserDID] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalDIDs: 0, totalVerifications: 0 });

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Vui lòng cài đặt MetaMask!");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      setAccount(accounts[0]);
      setContract(contractInstance);

      try {
        const didDoc = await contractInstance.didDocuments(accounts[0]);
        if (didDoc.isActive) setUserDID(didDoc);
        const [dids, verifications] = await contractInstance.getStats();
        setStats({ totalDIDs: Number(dids), totalVerifications: Number(verifications) });
      } catch (e) { console.log("Init data load error", e); }

    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const registerDID = async () => {
    if (!contract || !account) return;
    try {
      setLoading(true);
      const randomId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const did = `did:deepfake:${randomId}`;
      const publicKey = `pk_${randomId.substring(0, 32)}`;

      const tx = await contract.registerDID(did, publicKey);
      await tx.wait();

      const didDoc = await contract.didDocuments(account);
      setUserDID(didDoc);
      alert("Đăng ký DID thành công!");
    } catch (error) {
      console.error("Register Error:", error);
      alert("Lỗi đăng ký: " + error.message);
    } finally { setLoading(false); }
  };

  const verifyImage = async (file) => {
    if (!file) return;
    if (!account) {
      alert("Vui lòng kết nối ví trước để xác thực!");
      return;
    }

    try {
      setLoading(true);
      setVerificationResult(null);

      const formData = new FormData();
      formData.append('file', file);
      // QUAN TRỌNG: Gửi địa chỉ ví lên để Server ký
      formData.append('user_address', account); 

      // 1. GỌI API AI
      const response = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error("Backend verification failed");
      const result = await response.json();
      
      setVerificationResult(result);

      // 2. GHI LÊN BLOCKCHAIN (Nếu user đã có DID)
      if (contract && userDID) {
        const isReal = result.label === "REAL";
        const confidence = Math.round(result.confidence * 10000);
        
        // Lấy chữ ký từ Server
        const signature = result.signature; 
        console.log("Signature from server:", signature);

        // Convert image_hash to bytes32 format
        const imageHashBytes32 = "0x" + result.image_hash;

        try {
          const tx = await contract.recordVerification(
            imageHashBytes32,
            isReal,
            confidence,
            "0x" + signature // <--- Gửi chữ ký vào Contract
          );
          console.log("Tx sent:", tx.hash);
          await tx.wait();
          
          setVerificationResult(prev => ({
            ...prev,
            onChain: true,
            transactionHash: tx.hash
          }));
          alert("Đã lưu kết quả lên Blockchain an toàn!");
        } catch (e) {
          console.log("Blockchain Record Error:", e);
          // Check lỗi cụ thể
          if (e.reason) alert("Lỗi Contract: " + e.reason);
          else alert("Không thể lưu lên Blockchain (Có thể do chữ ký sai hoặc lỗi mạng)");
          
          setVerificationResult(prev => ({ ...prev, onChain: false }));
        }
      } else if (!userDID) {
        alert("Kết quả AI: " + result.label + ". (Bạn cần đăng ký DID để lưu kết quả này lên Blockchain)");
      }

    } catch (error) {
      console.error("Verification failed:", error);
      alert("Xác thực thất bại: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo"><span className="logo-text">DeepfakeVerify</span></div>
        </div>
      </header>

      <main className="main">
        <div className="page-header">
          <h1 className="page-title">Xác Thực Hình Ảnh Deepfake</h1>
        </div>

        <WalletConnect 
          account={account} userDID={userDID}
          onConnect={connectWallet} onDisconnect={() => {setAccount(null); setContract(null); setUserDID(null);}}
          onRegisterDID={registerDID} loading={loading}
        />

        <div className="stats-bar">
          <div className="stat"><span className="stat-value">{stats.totalDIDs}</span><span className="stat-label">DIDs</span></div>
          <div className="stat"><span className="stat-value">{stats.totalVerifications}</span><span className="stat-label">Verified</span></div>
        </div>

        <ImageUpload onUpload={verifyImage} loading={loading} />

        {verificationResult && (<VerificationResult result={verificationResult} />)}
      </main>
    </div>
  )
}

export default App