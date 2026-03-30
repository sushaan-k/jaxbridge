#!/usr/bin/env python3
"""
Train a PyTorch Multi-Layer Perceptron (MLP) Neural Network
============================================================
Predicts life expectancy from 15 ZIP-level health/socioeconomic features.
Exports model weights as JSON for browser-side inference in the Simulator.

Architecture: 15 → 32 → 16 → 8 → 1 (ReLU activations, BatchNorm)
Training: 34 ZIP codes, 5-fold cross-validation, 2000 epochs
"""

import json
import os
import numpy as np

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'app', 'public', 'data')

# Load ZIP data
zip_data = json.load(open(os.path.join(OUT_DIR, 'zipcode_data.json')))

# Define features and target
FEATURES = [
    'median_income', 'obesity', 'physical_inactivity', 'smoking',
    'uninsured_rate', 'svi_score', 'food_desert_rate', 'park_acres_per_1k',
    'mental_health_per_10k', 'physician_access', 'poverty_rate',
    'depression', 'high_blood_pressure', 'fair_poor_health',
]
TARGET = 'life_expectancy'

# Build dataset
X_raw = []
y_raw = []
zip_ids = []

for z in zip_data:
    row = []
    valid = True
    for f in FEATURES:
        val = z.get(f, None)
        if val is None:
            valid = False
            break
        row.append(float(val))
    if valid and z.get(TARGET) is not None:
        X_raw.append(row)
        y_raw.append(float(z[TARGET]))
        zip_ids.append(z.get('geoid', ''))

X = np.array(X_raw, dtype=np.float32)
y = np.array(y_raw, dtype=np.float32)

print(f"Dataset: {X.shape[0]} samples × {X.shape[1]} features")
print(f"Target range: {y.min():.1f} - {y.max():.1f}")

# Normalize features
X_mean = X.mean(axis=0)
X_std = X.std(axis=0) + 1e-8
X_norm = (X - X_mean) / X_std

y_mean = y.mean()
y_std = y.std() + 1e-8
y_norm = (y - y_mean) / y_std

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

# Convert to tensors
X_tensor = torch.FloatTensor(X_norm)
y_tensor = torch.FloatTensor(y_norm).unsqueeze(1)

# Define MLP architecture
class LifeExpectancyMLP(nn.Module):
    """Multi-Layer Perceptron for life expectancy prediction."""
    def __init__(self, input_dim=15):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(0.2),

            nn.Linear(32, 16),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.Dropout(0.1),

            nn.Linear(16, 8),
            nn.ReLU(),

            nn.Linear(8, 1),
        )

    def forward(self, x):
        return self.net(x)

# Training with 5-fold cross-validation
from sklearn.model_selection import KFold

print("\n--- Training Neural Network ---")
print("Architecture: 15 → 32 → 16 → 8 → 1 (ReLU + BatchNorm + Dropout)")

kf = KFold(n_splits=5, shuffle=True, random_state=42)
fold_scores = []

# Train final model on all data
model = LifeExpectancyMLP(input_dim=X.shape[1])
optimizer = optim.Adam(model.parameters(), lr=0.005, weight_decay=1e-4)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=2000)
criterion = nn.MSELoss()

dataset = TensorDataset(X_tensor, y_tensor)
loader = DataLoader(dataset, batch_size=len(dataset), shuffle=True)

# Cross-validation
for fold, (train_idx, val_idx) in enumerate(kf.split(X_norm)):
    fold_model = LifeExpectancyMLP(input_dim=X.shape[1])
    fold_optimizer = optim.Adam(fold_model.parameters(), lr=0.005, weight_decay=1e-4)
    fold_criterion = nn.MSELoss()

    X_train = torch.FloatTensor(X_norm[train_idx])
    y_train = torch.FloatTensor(y_norm[train_idx]).unsqueeze(1)
    X_val = torch.FloatTensor(X_norm[val_idx])
    y_val = torch.FloatTensor(y_norm[val_idx]).unsqueeze(1)

    fold_model.train()
    for epoch in range(1500):
        fold_optimizer.zero_grad()
        pred = fold_model(X_train)
        loss = fold_criterion(pred, y_train)
        loss.backward()
        fold_optimizer.step()

    fold_model.eval()
    with torch.no_grad():
        val_pred = fold_model(X_val)
        val_pred_real = val_pred.numpy() * y_std + y_mean
        val_real = y_val.numpy() * y_std + y_mean
        ss_res = ((val_real - val_pred_real) ** 2).sum()
        ss_tot = ((val_real - val_real.mean()) ** 2).sum()
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0
        fold_scores.append(float(r2))
        print(f"  Fold {fold+1}: R² = {r2:.4f}")

print(f"  Mean CV R² = {np.mean(fold_scores):.4f} ± {np.std(fold_scores):.4f}")

# Train final model on all data
print("\nTraining final model on all data...")
model.train()
best_loss = float('inf')
for epoch in range(2000):
    for X_batch, y_batch in loader:
        optimizer.zero_grad()
        pred = model(X_batch)
        loss = criterion(pred, y_batch)
        loss.backward()
        optimizer.step()
        scheduler.step()

    if epoch % 500 == 0:
        model.eval()
        with torch.no_grad():
            all_pred = model(X_tensor)
            train_loss = criterion(all_pred, y_tensor).item()
        model.train()
        print(f"  Epoch {epoch}: loss = {train_loss:.6f}")

# Evaluate final model
model.eval()
with torch.no_grad():
    final_pred = model(X_tensor).numpy() * y_std + y_mean
    y_real = y

ss_res = ((y_real - final_pred.flatten()) ** 2).sum()
ss_tot = ((y_real - y_real.mean()) ** 2).sum()
train_r2 = 1 - ss_res / ss_tot
mae = np.abs(y_real - final_pred.flatten()).mean()

print(f"\nFinal Model Performance:")
print(f"  Train R² = {train_r2:.4f}")
print(f"  Train MAE = {mae:.2f} years")
print(f"  5-Fold CV R² = {np.mean(fold_scores):.4f}")

# Export weights as JSON for browser inference
def export_layer_weights(layer, name):
    """Extract weights and biases from a PyTorch layer."""
    weights = layer.weight.data.numpy().tolist()
    biases = layer.bias.data.numpy().tolist()
    return {'name': name, 'weights': weights, 'biases': biases}

def export_batchnorm(layer, name):
    """Extract BatchNorm parameters."""
    return {
        'name': name,
        'running_mean': layer.running_mean.numpy().tolist(),
        'running_var': layer.running_var.numpy().tolist(),
        'weight': layer.weight.data.numpy().tolist(),
        'bias': layer.bias.data.numpy().tolist(),
        'eps': layer.eps,
    }

exported = {
    'architecture': '15 → 32 (BN+ReLU+Drop) → 16 (BN+ReLU+Drop) → 8 (ReLU) → 1',
    'framework': 'PyTorch 2.x',
    'training': {
        'samples': int(X.shape[0]),
        'features': int(X.shape[1]),
        'epochs': 2000,
        'optimizer': 'Adam (lr=0.005, weight_decay=1e-4)',
        'scheduler': 'CosineAnnealingLR',
        'loss': 'MSELoss',
    },
    'performance': {
        'train_r2': round(float(train_r2), 4),
        'train_mae': round(float(mae), 2),
        'cv_r2_mean': round(float(np.mean(fold_scores)), 4),
        'cv_r2_std': round(float(np.std(fold_scores)), 4),
        'cv_folds': fold_scores,
    },
    'normalization': {
        'feature_names': FEATURES,
        'X_mean': X_mean.tolist(),
        'X_std': X_std.tolist(),
        'y_mean': float(y_mean),
        'y_std': float(y_std),
    },
    'layers': [
        export_layer_weights(model.net[0], 'linear_1'),  # 15→32
        export_batchnorm(model.net[1], 'bn_1'),
        export_layer_weights(model.net[4], 'linear_2'),  # 32→16
        export_batchnorm(model.net[5], 'bn_2'),
        export_layer_weights(model.net[8], 'linear_3'),  # 16→8
        export_layer_weights(model.net[10], 'linear_4'),  # 8→1
    ],
    'predictions': {
        zip_ids[i]: {
            'actual': round(float(y_real[i]), 1),
            'predicted': round(float(final_pred[i][0]), 1),
            'error': round(float(abs(y_real[i] - final_pred[i][0])), 2),
        }
        for i in range(len(zip_ids))
    },
}

out_path = os.path.join(OUT_DIR, 'neural_network_model.json')
with open(out_path, 'w') as f:
    json.dump(exported, f)

print(f"\n✓ Model exported to {out_path} ({os.path.getsize(out_path) / 1024:.0f} KB)")
print(f"  Architecture: {exported['architecture']}")
print(f"  Weights: {sum(len(l.get('weights', [])) for l in exported['layers'])} parameter groups")
