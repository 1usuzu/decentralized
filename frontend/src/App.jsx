import { useState } from 'react'
import { ethers } from 'ethers'
import WalletConnect from './components/WalletConnect'
import ImageUpload from './components/ImageUpload'
import VerificationResult from './components/VerificationResult'
import './App.css'

// Contract ABI (simplified)
const CONTRACT_ABI = [
  "function registerDID(string calldata _did, string calldata _publicKeyBase58) external",
  "function recordVerification(bytes32 _imageHash, string calldata _subjectDid, bool _isReal, uint256 _confidence, bytes32 _credentialHash) external",
  "function getVerification(bytes32 _imageHash) external view returns (tuple(bytes32 imageHash, string subjectDid, string issuerDid, bool isReal, uint256 confidence, uint256 timestamp, bytes32 credentialHash))",
  "function isImageVerified(bytes32 _imageHash) external view returns (bool)",
  "function didDocuments(address) external view returns (address owner, string did, string publicKeyBase58, bool isActive, uint256 createdAt, uint256 updatedAt)",
  "function getStats() external view returns (uint256, uint256)"
];

// Contract address (will be updated after deployment)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [userDID, setUserDID] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalDIDs: 0, totalVerifications: 0 });

  // Connect wallet
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

      // Load user DID if exists
      try {
        const didDoc = await contractInstance.didDocuments(accounts[0]);
        if (didDoc.isActive) {
          setUserDID(didDoc);
        }
      } catch (e) {
        console.log("No DID found for this account");
      }

      // Load stats
      try {
        const [totalDIDs, totalVerifications] = await contractInstance.getStats();
        setStats({ 
          totalDIDs: Number(totalDIDs), 
          totalVerifications: Number(totalVerifications) 
        });
      } catch (e) {
        console.log("Could not load stats");
      }

    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
    setUserDID(null);
  };

  // Register DID
  const registerDID = async () => {
    if (!contract || !account) return;

    try {
      setLoading(true);
      
      // Generate random DID
      const randomId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const did = `did:deepfake:${randomId}`;
      const publicKey = `pk_${randomId.substring(0, 32)}`;

      const tx = await contract.registerDID(did, publicKey);
      await tx.wait();

      // Reload DID
      const didDoc = await contract.didDocuments(account);
      setUserDID(didDoc);

      alert("Đăng ký DID thành công!");
    } catch (error) {
      console.error("Failed to register DID:", error);
      alert("Đăng ký DID thất bại: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify image
  const verifyImage = async (file) => {
    if (!file) return;

    try {
      setLoading(true);
      setVerificationResult(null);

      // Upload to backend for AI detection
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error("Backend verification failed");
      }

      const result = await response.json();
      setVerificationResult(result);

      // Record on blockchain if contract connected
      if (contract && userDID) {
        const imageHash = ethers.keccak256(new Uint8Array(await file.arrayBuffer()));
        const isReal = result.label === "REAL";
        const confidence = Math.round(result.confidence * 10000);
        const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(result)));

        try {
          const tx = await contract.recordVerification(
            imageHash,
            userDID.did,
            isReal,
            confidence,
            credentialHash
          );
          await tx.wait();
          
          setVerificationResult(prev => ({
            ...prev,
            onChain: true,
            transactionHash: tx.hash
          }));
        } catch (e) {
          console.log("Could not record on blockchain:", e);
          setVerificationResult(prev => ({
            ...prev,
            onChain: false
          }));
        }
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
          <div className="logo">
            <div className="logo-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="logo-text">DeepfakeVerify</span>
          </div>
          <nav className="header-nav">
            <a href="#" className="nav-link">Trang chủ</a>
            <a href="#" className="nav-link">Hướng dẫn</a>
            <a href="#" className="nav-link">API</a>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="page-header">
          <h1 className="page-title">Xác Thực Hình Ảnh Deepfake</h1>
          <p className="page-description">
            Sử dụng AI để phát hiện hình ảnh giả mạo, kết hợp với định danh phi tập trung và lưu trữ trên blockchain
          </p>
        </div>

        {/* Wallet Connection */}
        <WalletConnect 
          account={account}
          userDID={userDID}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
          onRegisterDID={registerDID}
          loading={loading}
        />

        {/* Stats */}
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-value">{stats.totalDIDs}</span>
            <span className="stat-label">DIDs đã đăng ký</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.totalVerifications}</span>
            <span className="stat-label">Lượt xác thực</span>
          </div>
        </div>

        {/* Image Upload */}
        <ImageUpload 
          onUpload={verifyImage}
          loading={loading}
        />

        {/* Verification Result */}
        {verificationResult && (
          <VerificationResult result={verificationResult} />
        )}
      </main>

      <footer className="footer">
        <p className="footer-text">© 2025 DeepfakeVerify - Đồ án tốt nghiệp</p>
      </footer>
    </div>
  )
}

export default App
