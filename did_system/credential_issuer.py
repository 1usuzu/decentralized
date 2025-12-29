"""
Credential Issuer - Verifiable Credentials (W3C VC Data Model)
"""

import json
import uuid
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from cryptography.hazmat.primitives.asymmetric import ed25519


class CredentialIssuer:
    """Issues Verifiable Credentials for deepfake detection results"""
    
    def __init__(self, issuer_did: str, issuer_private_key: ed25519.Ed25519PrivateKey):
        self.issuer_did = issuer_did
        self.issuer_private_key = issuer_private_key
    
    def create_credential(
        self,
        subject_did: str,
        image_hash: str,
        detection_result: Dict,
        credential_id: Optional[str] = None,
        expiry_days: int = 365
    ) -> Dict:
        """Create deepfake detection credential"""
        if credential_id is None:
            credential_id = f"urn:uuid:{uuid.uuid4()}"
        
        issued_at = datetime.now(timezone.utc)
        expires_at = issued_at + timedelta(days=expiry_days)
        
        return {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                {"DeepfakeDetectionCredential": "https://example.com/credentials/deepfake/v1"}
            ],
            "id": credential_id,
            "type": ["VerifiableCredential", "DeepfakeDetectionCredential"],
            "issuer": self.issuer_did,
            "issuanceDate": issued_at.isoformat(),
            "expirationDate": expires_at.isoformat(),
            "credentialSubject": {
                "id": subject_did,
                "imageHash": image_hash,
                "detectionResult": {
                    "label": detection_result.get('label', 'UNKNOWN'),
                    "confidence": round(detection_result.get('confidence', 0.0), 6),
                    "realProbability": round(detection_result.get('real_prob', 0.0), 6),
                    "fakeProbability": round(detection_result.get('fake_prob', 0.0), 6),
                    "timestamp": issued_at.isoformat()
                }
            }
        }
    
    def sign_credential(self, credential: Dict) -> Dict:
        """Sign credential with Ed25519"""
        credential_json = json.dumps(credential, sort_keys=True, separators=(',', ':'))
        signature = self.issuer_private_key.sign(credential_json.encode('utf-8'))
        
        signed = credential.copy()
        signed["proof"] = {
            "type": "Ed25519Signature2020",
            "created": datetime.now(timezone.utc).isoformat(),
            "verificationMethod": f"{self.issuer_did}#key-1",
            "proofPurpose": "assertionMethod",
            "proofValue": base64.b64encode(signature).decode('utf-8')
        }
        
        return signed
    
    def issue_credential(
        self,
        subject_did: str,
        image_hash: str,
        detection_result: Dict
    ) -> Dict:
        """Create and sign credential"""
        credential = self.create_credential(subject_did, image_hash, detection_result)
        return self.sign_credential(credential)
    
    def verify_credential(
        self, 
        credential: Dict, 
        issuer_public_key: ed25519.Ed25519PublicKey
    ) -> bool:
        """Verify credential signature and expiration"""
        if 'proof' not in credential:
            return False
        
        # Check expiration
        if 'expirationDate' in credential:
            try:
                expiration = datetime.fromisoformat(credential['expirationDate'].replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expiration:
                    return False
            except (ValueError, TypeError):
                pass
        
        proof = credential.pop('proof')
        
        try:
            signature = base64.b64decode(proof.get('proofValue', ''))
            credential_json = json.dumps(credential, sort_keys=True, separators=(',', ':'))
            issuer_public_key.verify(signature, credential_json.encode('utf-8'))
            credential['proof'] = proof
            return True
        except Exception:
            credential['proof'] = proof
            return False
    
    def save_credential(self, credential: Dict, filepath: str):
        """Save credential to file"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(credential, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    from did_manager import DIDManager
    import hashlib
    
    # Setup
    manager = DIDManager()
    issuer_data = manager.register_did()
    subject_data = manager.register_did()
    
    issuer = CredentialIssuer(
        issuer_did=issuer_data['did'],
        issuer_private_key=issuer_data['keypair']['private_key']
    )
    
    # Issue credential
    credential = issuer.issue_credential(
        subject_did=subject_data['did'],
        image_hash=hashlib.sha256(b"test").hexdigest(),
        detection_result={'label': 'REAL', 'confidence': 0.92, 'real_prob': 0.92, 'fake_prob': 0.08}
    )
    
    print(f"Credential: {json.dumps(credential, indent=2)}")
    
    # Verify
    is_valid = issuer.verify_credential(credential, issuer_data['keypair']['public_key'])
    print(f"Valid: {is_valid}")
