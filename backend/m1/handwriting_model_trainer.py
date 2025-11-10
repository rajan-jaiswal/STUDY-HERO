# handwriting_model_trainer.py

import os
import cv2
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout
from tensorflow.keras.optimizers import Adam
import pickle

# 1. Set paths
DATASET_DIR = "./uploads/handwriting_dataset"
MODEL_PATH = "./ml/handwriting_model.h5"
LABEL_ENCODER_PATH = "./ml/label_encoder.pkl"
IMG_SIZE = 128

# 2. Load images and labels
def load_data():
    images = []
    labels = []
    
    for student_folder in os.listdir(DATASET_DIR):
        student_path = os.path.join(DATASET_DIR, student_folder)
        if not os.path.isdir(student_path):
            continue
        for img_file in os.listdir(student_path):
            if img_file.endswith(('.png', '.jpg', '.jpeg')):
                img_path = os.path.join(student_path, img_file)
                img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
                images.append(img)
                labels.append(student_folder)
    
    return np.array(images), np.array(labels)

# 3. Prepare dataset
def preprocess_data(images, labels):
    images = images.astype('float32') / 255.0
    images = images.reshape(-1, IMG_SIZE, IMG_SIZE, 1)
    
    le = LabelEncoder()
    labels_encoded = le.fit_transform(labels)
    labels_categorical = to_categorical(labels_encoded)

    return images, labels_categorical, le

# 4. Build model
def build_model(input_shape, num_classes):
    model = Sequential([
        Conv2D(32, (3, 3), activation='relu', input_shape=input_shape),
        MaxPooling2D((2, 2)),
        Dropout(0.25),
        
        Conv2D(64, (3, 3), activation='relu'),
        MaxPooling2D((2, 2)),
        Dropout(0.25),
        
        Flatten(),
        Dense(128, activation='relu'),
        Dropout(0.5),
        Dense(num_classes, activation='softmax')
    ])
    
    model.compile(optimizer=Adam(), loss='categorical_crossentropy', metrics=['accuracy'])
    return model

# 5. Train model
def train_model():
    images, labels = load_data()
    images, labels_categorical, le = preprocess_data(images, labels)

    X_train, X_test, y_train, y_test = train_test_split(images, labels_categorical, test_size=0.2, random_state=42)

    model = build_model((IMG_SIZE, IMG_SIZE, 1), num_classes=labels_categorical.shape[1])

    history = model.fit(X_train, y_train, epochs=10, validation_data=(X_test, y_test), batch_size=32)

    # Save model and encoder
    model.save(MODEL_PATH)
    with open(LABEL_ENCODER_PATH, 'wb') as f:
        pickle.dump(le, f)

    print(f"✅ Model trained and saved at {MODEL_PATH}")
    print(f"✅ Label encoder saved at {LABEL_ENCODER_PATH}")

    # Plot accuracy
    plt.plot(history.history['accuracy'], label='Train Acc')
    plt.plot(history.history['val_accuracy'], label='Val Acc')
    plt.legend()
    plt.title('Accuracy')
    plt.show()

if __name__ == "__main__":
    train_model()
