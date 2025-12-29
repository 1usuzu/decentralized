"""
Deepfake Detector - AI Model Inference
"""

import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image


class DeepfakeDetector:
    """EfficientNet-B0 based deepfake detector with temperature scaling"""
    
    def __init__(self, model_path="d:/Code/face/ai_deepfake/models/best_model.pth", temperature=3.5):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.temperature = temperature
        
        # Load model
        self.model = models.efficientnet_b0(weights=None)
        num_features = self.model.classifier[1].in_features
        self.model.classifier[1] = nn.Linear(num_features, 2)
        
        checkpoint = torch.load(model_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model = self.model.to(self.device)
        self.model.eval()
        
        # Transform
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225])
        ])
        
        print(f"Model loaded (Device: {self.device}, Temperature: {self.temperature})")
    
    def predict(self, image_path):
        """Predict single image"""
        img = Image.open(image_path).convert('RGB')
        img_tensor = self.transform(img).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            output = self.model(img_tensor)
            probs = torch.softmax(output / self.temperature, dim=1)
            pred = output.argmax(1).item()
        
        # ImageFolder sorts alphabetically: fake=0, real=1
        fake_prob = probs[0][0].item()
        real_prob = probs[0][1].item()
        
        label = "FAKE" if pred == 0 else "REAL"
        confidence = fake_prob if pred == 0 else real_prob
        
        return {
            'label': label,
            'confidence': confidence,
            'real_prob': real_prob,
            'fake_prob': fake_prob
        }


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python detect.py <image_path>")
        sys.exit(1)
    
    detector = DeepfakeDetector()
    result = detector.predict(sys.argv[1])
    
    print(f"Result: {result['label']}")
    print(f"Confidence: {result['confidence']*100:.2f}%")
    print(f"Real: {result['real_prob']*100:.2f}%")
    print(f"Fake: {result['fake_prob']*100:.2f}%")
