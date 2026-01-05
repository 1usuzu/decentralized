import './VerificationResult.css'

// Tự động chọn block explorer dựa trên Chain ID
const getExplorerUrl = (txHash) => {
  const chainId = import.meta.env.VITE_CHAIN_ID;
  const explorers = {
    '11155111': `https://sepolia.etherscan.io/tx/${txHash}`,
    '80002': `https://amoy.polygonscan.com/tx/${txHash}`,
    '31337': null // Hardhat local không có explorer
  };
  return explorers[chainId] || null;
};

function VerificationResult({ result }) {
  const isReal = result.label === 'REAL';
  const confidence = (result.confidence * 100).toFixed(1);
  
  return (
    <div className={`verification-result ${isReal ? 'real' : 'fake'}`}>
      <div className="result-header">
        <div className="result-icon">
          {isReal ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
        </div>
        <div className="result-title">
          <h3>{isReal ? 'Ảnh Thật' : 'Phát hiện Deepfake'}</h3>
          <p>{isReal ? 'Không phát hiện dấu hiệu chỉnh sửa AI' : 'Phát hiện dấu hiệu ảnh được tạo hoặc chỉnh sửa bởi AI'}</p>
        </div>
      </div>

      <div className="confidence-section">
        <div className="confidence-header">
          <span className="confidence-label">Độ tin cậy</span>
          <span className="confidence-value">{confidence}%</span>
        </div>
        <div className="confidence-bar">
          <div 
            className="confidence-fill" 
            style={{ width: `${confidence}%` }}
          ></div>
        </div>
      </div>

      <div className="details-section">
        <div className="detail-item">
          <span className="detail-label">Xác suất REAL</span>
          <span className="detail-value">{(result.real_prob * 100).toFixed(2)}%</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Xác suất FAKE</span>
          <span className="detail-value">{(result.fake_prob * 100).toFixed(2)}%</span>
        </div>
      </div>

      {/* Blockchain status */}
      <div className="blockchain-section">
        <div className="blockchain-header">
          Lưu trữ Blockchain
        </div>
        
        {result.onChain ? (
          <div className="blockchain-status blockchain-success">
            <svg className="status-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <div className="status-details">
              <span className="status-text">Đã lưu lên blockchain</span>
              {result.transactionHash && getExplorerUrl(result.transactionHash) && (
                <a 
                  href={getExplorerUrl(result.transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  Xem transaction
                </a>
              )}
              {result.transactionHash && !getExplorerUrl(result.transactionHash) && (
                <span className="tx-hash">TX: {result.transactionHash.substring(0, 16)}...</span>
              )}
            </div>
          </div>
        ) : (
          <div className="blockchain-status blockchain-pending">
            <svg className="status-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="status-text">Chưa lưu lên blockchain - Cần đăng ký DID</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerificationResult;
