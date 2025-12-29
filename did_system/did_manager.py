"""
DID Manager - Decentralized Identifiers (W3C DID Core)
"""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
import base58


class DIDManager:
    """Manages DID creation and DID Documents"""
    
    def __init__(self, did_method: str = "deepfake"):
        self.did_method = did_method
    
    def generate_keypair(self) -> Dict:
        """Generate Ed25519 keypair"""
        private_key = ed25519.Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        private_key_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        return {
            'private_key': private_key,
            'public_key': public_key,
            'private_key_bytes': private_key_bytes.hex(),
            'public_key_bytes': public_key_bytes.hex(),
            'public_key_base58': base58.b58encode(public_key_bytes).decode('utf-8')
        }
    
    def create_did(self, public_key_base58: str) -> str:
        """Create DID from public key"""
        return f"did:{self.did_method}:{public_key_base58}"
    
    def create_did_document(
        self, 
        did: str, 
        public_key_base58: str,
        controller: Optional[str] = None,
        service_endpoints: Optional[List[Dict]] = None
    ) -> Dict:
        """Create W3C compliant DID Document"""
        if controller is None:
            controller = did
        
        did_document = {
            "@context": [
                "https://www.w3.org/ns/did/v1",
                "https://w3id.org/security/suites/ed25519-2020/v1"
            ],
            "id": did,
            "controller": controller,
            "verificationMethod": [{
                "id": f"{did}#key-1",
                "type": "Ed25519VerificationKey2020",
                "controller": controller,
                "publicKeyBase58": public_key_base58
            }],
            "authentication": [f"{did}#key-1"],
            "assertionMethod": [f"{did}#key-1"],
            "created": datetime.now(timezone.utc).isoformat(),
            "updated": datetime.now(timezone.utc).isoformat()
        }
        
        if service_endpoints:
            did_document["service"] = service_endpoints
        
        return did_document
    
    def register_did(
        self, 
        keypair: Optional[Dict] = None,
        service_endpoints: Optional[List[Dict]] = None
    ) -> Dict:
        """Register new DID with keypair and DID Document"""
        if keypair is None:
            keypair = self.generate_keypair()
        
        did = self.create_did(keypair['public_key_base58'])
        did_document = self.create_did_document(
            did=did,
            public_key_base58=keypair['public_key_base58'],
            service_endpoints=service_endpoints
        )
        
        return {
            'did': did,
            'did_document': did_document,
            'keypair': keypair
        }
    
    def export_did(self, did_data: Dict, filepath: str):
        """Export DID data to JSON file"""
        export_data = {
            'did': did_data['did'],
            'did_document': did_data['did_document'],
            'keypair': {
                'private_key_bytes': did_data['keypair']['private_key_bytes'],
                'public_key_bytes': did_data['keypair']['public_key_bytes'],
                'public_key_base58': did_data['keypair']['public_key_base58']
            }
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    manager = DIDManager()
    did_data = manager.register_did()
    
    print(f"DID: {did_data['did']}")
    print(f"Document: {json.dumps(did_data['did_document'], indent=2)}")
