import { useState } from 'react'
import { ethers } from 'ethers'
import WalletConnect from './components/WalletConnect'
import ImageUpload from './components/ImageUpload'
import VerificationResult from './components/VerificationResult'
import './App.css'

// SVGs for Pillars
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
)
const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
)
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
)

const CONTRACT_ABI = [
  "function registerDID(string calldata _did, string calldata _publicKeyBase58) external",
  "function recordVerification(bytes32 _imageHash, bool _isReal, uint256 _confidence, bytes calldata _signature) external",
  "function getVerification(bytes32 _imageHash) external view returns (tuple(bytes32 imageHash, string subjectDid, string issuerDid, bool isReal, uint256 confidence, uint256 timestamp, bytes32 credentialHash))",
  "function didDocuments(address) external view returns (address owner, string did, string publicKeyBase58, bool isActive, uint256 createdAt, uint256 updatedAt)",
  "function getStats() external view returns (uint256, uint256)"
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x_YOUR_CONTRACT_ADDRESS";
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
      } catch (e) { console.log("Init data load error (Contract might not be deployed yet)", e); }

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
      formData.append('user_address', account); 

      // 1. Call AI API
      const response = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error("Backend verification failed");
      const result = await response.json();
      
      setVerificationResult(result);

      // 2. Record on Blockchain (If user has DID)
      if (contract && userDID) {
        const isReal = result.label === "REAL";
        const confidence = Math.round(result.confidence * 10000);
        const signature = result.signature; 
        const imageHashBytes32 = "0x" + result.image_hash;

        try {
          const tx = await contract.recordVerification(
            imageHashBytes32,
            isReal,
            confidence,
            "0x" + signature 
          );
          await tx.wait();
          
          setVerificationResult(prev => ({
            ...prev,
            onChain: true,
            transactionHash: tx.hash
          }));
          alert("Đã lưu kết quả lên Blockchain an toàn!");
        } catch (e) {
          console.log("Blockchain Record Error:", e);
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
          <div className="logo">
            <div className="logo-icon">
              <ShieldIcon />
            </div>
            <span className="logo-text">DeepTrust<span style={{color: 'var(--primary)'}}>.AI</span></span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="page-header">
          <h1 className="page-title">
            <span className="text-gradient">Trust But Verify</span><br />
            in the Age of AI
          </h1>
          <p className="page-subtitle">
            Secure, decentralized authentication powered by artificial intelligence and zero-knowledge proofs.
          </p>
        </div>

        {/* 3 Pillars of the System */}
        <div className="pillars-grid">
          <div className="pillar-card pillar-did">
            <div className="pillar-icon"><ShieldIcon /></div>
            <h3 className="pillar-title">Decentralized Identity</h3>
            <p className="pillar-desc">
              You own your identity. No central server controls your data. Cryptographic proof of personhood ensures you are in control.
            </p>
          </div>
          <div className="pillar-card pillar-ai">
            <div className="pillar-icon"><BrainIcon /></div>
            <h3 className="pillar-title">AI Deepfake Detection</h3>
            <p className="pillar-desc">
              Advanced neural networks analyze micro-expressions and artifacts to detect manipulated media with high precision.
            </p>
          </div>
          <div className="pillar-card pillar-zkp">
            <div className="pillar-icon"><LockIcon /></div>
            <h3 className="pillar-title">Zero-Knowledge Proofs</h3>
            <p className="pillar-desc">
              Verify authenticity without revealing the underlying sensitive data. True privacy-preserving verification.
            </p>
          </div>
        </div>

        <div className="stats-bar">
          <div className="stat">
            <span className="stat-value">{stats.totalDIDs}</span>
            <span className="stat-label">Identities Secured</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.totalVerifications}</span>
            <span className="stat-label">Images Verified</span>
          </div>
        </div>

        <div className="action-container">
          <WalletConnect 
            account={account} userDID={userDID}
            onConnect={connectWallet} onDisconnect={() => {setAccount(null); setContract(null); setUserDID(null);}}
            onRegisterDID={registerDID} loading={loading}
          />

          <ImageUpload onUpload={verifyImage} loading={loading} />

          {verificationResult && (<VerificationResult result={verificationResult} />)}
        </div>
      </main>
    </div>
  )
}

export default App