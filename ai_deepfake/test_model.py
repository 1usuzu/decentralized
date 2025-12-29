"""
Test Model on Test Set
"""

import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from pathlib import Path
from tqdm import tqdm


def test_model():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model_path = Path("d:/Code/face/ai_deepfake/models/best_model.pth")
    
    if not model_path.exists():
        print("Model not found!")
        return
    
    print(f"Device: {device}")
    print(f"Model: {model_path}")
    
    # Create model
    model = models.efficientnet_b0(weights=None)
    num_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_features, 2)
    
    # Load weights
    checkpoint = torch.load(model_path, map_location=device, weights_only=True)
    model.load_state_dict(checkpoint['model_state_dict'])
    model = model.to(device)
    model.eval()
    
    print(f"Model loaded (Best Val Acc: {checkpoint['val_acc']:.2f}%)")
    
    # Transform
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                           std=[0.229, 0.224, 0.225])
    ])
    
    # Load test data
    test_dataset = datasets.ImageFolder(
        root="d:/Code/face/ai_deepfake/dataset_final/test",
        transform=transform
    )
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)
    
    print(f"Test dataset: {len(test_dataset)} images")
    print(f"Classes: {test_dataset.classes}")
    
    # Test
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(test_loader, desc="Testing"):
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            _, predicted = outputs.max(1)
            
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    
    accuracy = 100. * correct / total
    
    # Confusion Matrix
    tp = sum(1 for l, p in zip(all_labels, all_preds) if l == 1 and p == 1)
    tn = sum(1 for l, p in zip(all_labels, all_preds) if l == 0 and p == 0)
    fp = sum(1 for l, p in zip(all_labels, all_preds) if l == 0 and p == 1)
    fn = sum(1 for l, p in zip(all_labels, all_preds) if l == 1 and p == 0)
    
    print(f"\nTest Accuracy: {accuracy:.2f}%")
    print(f"\nConfusion Matrix:")
    print(f"                Predicted")
    print(f"                Real    Fake")
    print(f"Actual Real     {tn:<6}  {fp:<6}")
    print(f"Actual Fake     {fn:<6}  {tp:<6}")
    
    # Metrics
    precision_real = tn / (tn + fn) if (tn + fn) > 0 else 0
    precision_fake = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall_real = tn / (tn + fp) if (tn + fp) > 0 else 0
    recall_fake = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1_real = 2 * precision_real * recall_real / (precision_real + recall_real) if (precision_real + recall_real) > 0 else 0
    f1_fake = 2 * precision_fake * recall_fake / (precision_fake + recall_fake) if (precision_fake + recall_fake) > 0 else 0
    
    print(f"\n{'Class':<10} {'Precision':<12} {'Recall':<12} {'F1-Score'}")
    print("-" * 46)
    print(f"{'Real':<10} {precision_real:<12.2%} {recall_real:<12.2%} {f1_real:.2%}")
    print(f"{'Fake':<10} {precision_fake:<12.2%} {recall_fake:<12.2%} {f1_fake:.2%}")
    
    return accuracy


if __name__ == "__main__":
    test_model()
