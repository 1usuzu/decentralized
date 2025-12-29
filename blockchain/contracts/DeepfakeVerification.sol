// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeepfakeVerification
 * @dev Smart contract cho hệ thống xác thực Deepfake với DID
 * 
 * Chức năng:
 * 1. Đăng ký DID (Decentralized Identifier)
 * 2. Lưu kết quả verification lên blockchain
 * 3. Verify credential bằng ZK Proof
 * 4. Query lịch sử verification
 */
contract DeepfakeVerification {
    
    // ============ STRUCTS ============
    
    // DID Document structure
    struct DIDDocument {
        address owner;              // Wallet address của owner
        string did;                 // DID string (did:deepfake:...)
        string publicKeyBase58;     // Public key
        bool isActive;              // Còn active không
        uint256 createdAt;          // Timestamp tạo
        uint256 updatedAt;          // Timestamp update
    }
    
    // Verification Result structure
    struct VerificationResult {
        bytes32 imageHash;          // SHA256 hash của ảnh
        string subjectDid;          // DID của subject
        string issuerDid;           // DID của issuer
        bool isReal;                // true = REAL, false = FAKE
        uint256 confidence;         // Confidence * 10000 (để lưu decimal, ví dụ 9182 = 91.82%)
        uint256 timestamp;          // Thời điểm verify
        bytes32 credentialHash;     // Hash của Verifiable Credential
    }
    
    // ZK Proof structure (simplified)
    struct ZKProof {
        bytes32 proofHash;          // Hash của proof
        bytes32 publicInputHash;    // Hash của public inputs
        bool isValid;               // Proof đã được verify chưa
        uint256 timestamp;          // Timestamp
    }
    
    // ============ STATE VARIABLES ============
    
    // Mapping từ wallet address → DID Document
    mapping(address => DIDDocument) public didDocuments;
    
    // Mapping từ DID string → wallet address
    mapping(string => address) public didToAddress;
    
    // Mapping từ image hash → Verification Result
    mapping(bytes32 => VerificationResult) public verificationResults;
    
    // Mapping từ image hash → ZK Proof
    mapping(bytes32 => ZKProof) public zkProofs;
    
    // Danh sách các issuer được authorize
    mapping(address => bool) public authorizedIssuers;
    
    // Owner của contract
    address public owner;
    
    // Oracle signer address (AI Server's wallet)
    address public oracleSigner;
    
    // Counters
    uint256 public totalDIDs;
    uint256 public totalVerifications;
    
    // ============ EVENTS ============
    
    event DIDRegistered(address indexed owner, string did, uint256 timestamp);
    event DIDUpdated(address indexed owner, string did, uint256 timestamp);
    event DIDDeactivated(address indexed owner, string did, uint256 timestamp);
    
    event VerificationRecorded(
        bytes32 indexed imageHash, 
        string subjectDid, 
        bool isReal, 
        uint256 confidence,
        uint256 timestamp
    );
    
    event ZKProofSubmitted(bytes32 indexed imageHash, bytes32 proofHash, uint256 timestamp);
    event ZKProofVerified(bytes32 indexed imageHash, bool isValid, uint256 timestamp);
    
    event IssuerAuthorized(address indexed issuer, uint256 timestamp);
    event IssuerRevoked(address indexed issuer, uint256 timestamp);
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }
    
    modifier didExists(address _owner) {
        require(didDocuments[_owner].isActive, "DID does not exist or is deactivated");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _oracleSigner) {
        owner = msg.sender;
        oracleSigner = _oracleSigner;
        authorizedIssuers[msg.sender] = true;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Cập nhật Oracle Signer (chỉ owner)
     */
    function setOracleSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        oracleSigner = _newSigner;
    }
    
    // ============ DID MANAGEMENT ============
    
    /**
     * @dev Đăng ký DID mới
     * @param _did DID string (ví dụ: did:deepfake:abc123)
     * @param _publicKeyBase58 Public key encoded in base58
     */
    function registerDID(
        string calldata _did, 
        string calldata _publicKeyBase58
    ) external {
        require(!didDocuments[msg.sender].isActive, "DID already registered");
        require(didToAddress[_did] == address(0), "DID already taken");
        require(bytes(_did).length > 0, "DID cannot be empty");
        require(bytes(_publicKeyBase58).length > 0, "Public key cannot be empty");
        
        didDocuments[msg.sender] = DIDDocument({
            owner: msg.sender,
            did: _did,
            publicKeyBase58: _publicKeyBase58,
            isActive: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        didToAddress[_did] = msg.sender;
        totalDIDs++;
        
        emit DIDRegistered(msg.sender, _did, block.timestamp);
    }
    
    /**
     * @dev Cập nhật public key của DID
     * @param _newPublicKeyBase58 Public key mới
     */
    function updateDIDPublicKey(
        string calldata _newPublicKeyBase58
    ) external didExists(msg.sender) {
        require(bytes(_newPublicKeyBase58).length > 0, "Public key cannot be empty");
        
        didDocuments[msg.sender].publicKeyBase58 = _newPublicKeyBase58;
        didDocuments[msg.sender].updatedAt = block.timestamp;
        
        emit DIDUpdated(msg.sender, didDocuments[msg.sender].did, block.timestamp);
    }
    
    /**
     * @dev Vô hiệu hóa DID
     */
    function deactivateDID() external didExists(msg.sender) {
        string memory did = didDocuments[msg.sender].did;
        
        didDocuments[msg.sender].isActive = false;
        didDocuments[msg.sender].updatedAt = block.timestamp;
        delete didToAddress[did];
        
        emit DIDDeactivated(msg.sender, did, block.timestamp);
    }
    
    /**
     * @dev Resolve DID → DID Document
     * @param _did DID string
     */
    function resolveDID(string calldata _did) external view returns (DIDDocument memory) {
        address didOwner = didToAddress[_did];
        require(didOwner != address(0), "DID not found");
        require(didDocuments[didOwner].isActive, "DID is deactivated");
        
        return didDocuments[didOwner];
    }
    
    // ============ VERIFICATION MANAGEMENT ============
    
    /**
     * @dev Ghi kết quả verification lên blockchain (cần signature từ Oracle)
     * @param _imageHash SHA256 hash của ảnh
     * @param _subjectDid DID của subject
     * @param _isReal true = REAL, false = FAKE
     * @param _confidence Confidence * 10000 (ví dụ: 9182 = 91.82%)
     * @param _credentialHash Hash của Verifiable Credential
     * @param _signature Signature từ Oracle Server để verify kết quả
     */
    function recordVerification(
        bytes32 _imageHash,
        string calldata _subjectDid,
        bool _isReal,
        uint256 _confidence,
        bytes32 _credentialHash,
        bytes calldata _signature
    ) external didExists(msg.sender) {
        require(_imageHash != bytes32(0), "Image hash cannot be empty");
        require(_confidence <= 10000, "Confidence must be <= 10000");
        
        // Verify signature from Oracle
        bytes32 messageHash = keccak256(abi.encodePacked(
            _imageHash,
            _isReal,
            _confidence
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        address recoveredSigner = recoverSigner(ethSignedHash, _signature);
        require(recoveredSigner == oracleSigner, "Invalid oracle signature");
        
        verificationResults[_imageHash] = VerificationResult({
            imageHash: _imageHash,
            subjectDid: _subjectDid,
            issuerDid: didDocuments[msg.sender].did,
            isReal: _isReal,
            confidence: _confidence,
            timestamp: block.timestamp,
            credentialHash: _credentialHash
        });
        
        totalVerifications++;
        
        emit VerificationRecorded(_imageHash, _subjectDid, _isReal, _confidence, block.timestamp);
    }
    
    /**
     * @dev Query kết quả verification
     * @param _imageHash SHA256 hash của ảnh
     */
    function getVerification(bytes32 _imageHash) external view returns (VerificationResult memory) {
        require(verificationResults[_imageHash].timestamp > 0, "Verification not found");
        return verificationResults[_imageHash];
    }
    
    /**
     * @dev Kiểm tra ảnh đã được verify chưa
     * @param _imageHash SHA256 hash của ảnh
     */
    function isImageVerified(bytes32 _imageHash) external view returns (bool) {
        return verificationResults[_imageHash].timestamp > 0;
    }
    
    // ============ ZK PROOF MANAGEMENT ============
    
    /**
     * @dev Submit ZK Proof
     * @param _imageHash Hash của ảnh
     * @param _proofHash Hash của ZK proof
     * @param _publicInputHash Hash của public inputs
     */
    function submitZKProof(
        bytes32 _imageHash,
        bytes32 _proofHash,
        bytes32 _publicInputHash
    ) external {
        require(_imageHash != bytes32(0), "Image hash cannot be empty");
        require(_proofHash != bytes32(0), "Proof hash cannot be empty");
        
        zkProofs[_imageHash] = ZKProof({
            proofHash: _proofHash,
            publicInputHash: _publicInputHash,
            isValid: false,
            timestamp: block.timestamp
        });
        
        emit ZKProofSubmitted(_imageHash, _proofHash, block.timestamp);
    }
    
    /**
     * @dev Verify ZK Proof (simplified - trong thực tế cần ZK verifier)
     * @param _imageHash Hash của ảnh
     * @param _expectedProofHash Expected proof hash để verify
     */
    function verifyZKProof(
        bytes32 _imageHash,
        bytes32 _expectedProofHash
    ) external view returns (bool) {
        ZKProof memory proof = zkProofs[_imageHash];
        require(proof.timestamp > 0, "ZK Proof not found");
        
        // Simplified verification - compare hashes
        // Trong thực tế cần implement ZK verifier (SNARK/STARK)
        return proof.proofHash == _expectedProofHash;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Authorize một issuer mới
     * @param _issuer Address của issuer
     */
    function authorizeIssuer(address _issuer) external onlyOwner {
        require(!authorizedIssuers[_issuer], "Already authorized");
        authorizedIssuers[_issuer] = true;
        emit IssuerAuthorized(_issuer, block.timestamp);
    }
    
    /**
     * @dev Thu hồi quyền issuer
     * @param _issuer Address của issuer
     */
    function revokeIssuer(address _issuer) external onlyOwner {
        require(authorizedIssuers[_issuer], "Not authorized");
        require(_issuer != owner, "Cannot revoke owner");
        authorizedIssuers[_issuer] = false;
        emit IssuerRevoked(_issuer, block.timestamp);
    }
    
    /**
     * @dev Transfer ownership
     * @param _newOwner Address của owner mới
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        authorizedIssuers[owner] = false;
        owner = _newOwner;
        authorizedIssuers[_newOwner] = true;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Lấy thông tin DID của caller
     */
    function getMyDID() external view returns (DIDDocument memory) {
        require(didDocuments[msg.sender].isActive, "No active DID");
        return didDocuments[msg.sender];
    }
    
    /**
     * @dev Kiểm tra address có phải authorized issuer không
     */
    function isAuthorizedIssuer(address _address) external view returns (bool) {
        return authorizedIssuers[_address];
    }
    
    /**
     * @dev Lấy statistics
     */
    function getStats() external view returns (uint256 _totalDIDs, uint256 _totalVerifications) {
        return (totalDIDs, totalVerifications);
    }
    
    // ============ SIGNATURE RECOVERY ============
    
    /**
     * @dev Recover signer address from signature
     */
    function recoverSigner(bytes32 _ethSignedHash, bytes memory _signature) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v value");
        
        return ecrecover(_ethSignedHash, v, r, s);
    }
    
    /**
     * @dev Get oracle signer address
     */
    function getOracleSigner() external view returns (address) {
        return oracleSigner;
    }
}
