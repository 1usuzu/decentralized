import './WalletConnect.css'

function WalletConnect({ account, userDID, onConnect, onDisconnect, onRegisterDID, loading }) {
  
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="wallet-connect">
      {!account ? (
        <div className="connect-section">
          <div className="connect-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
            </svg>
          </div>
          <h3>Kết nối ví để bắt đầu</h3>
          <p>Sử dụng MetaMask để đăng ký DID và lưu kết quả xác thực lên blockchain</p>
          <button className="btn btn-primary" onClick={onConnect}>
            Kết nối ví
          </button>
        </div>
      ) : (
        <div className="connected-section">
          <div className="account-info">
            <div className="account-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="account-details">
              <span className="account-label">Địa chỉ ví</span>
              <span className="account-address">{formatAddress(account)}</span>
            </div>
            <button className="btn btn-outline" onClick={onDisconnect}>
              Ngắt kết nối
            </button>
          </div>

          {!userDID ? (
            <div className="did-section">
              <div className="did-warning">
                <svg className="warning-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>Bạn chưa có DID. Đăng ký để lưu kết quả xác thực lên blockchain.</span>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={onRegisterDID}
                disabled={loading}
              >
                {loading ? 'Đang xử lý...' : 'Đăng ký DID'}
              </button>
            </div>
          ) : (
            <div className="did-section did-active">
              <div className="did-info">
                <div className="did-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                  </svg>
                </div>
                <div className="did-details">
                  <span className="did-label">DID của bạn</span>
                  <span className="did-value">{userDID.did.substring(0, 30)}...</span>
                </div>
                <span className="did-status active">Active</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WalletConnect;
