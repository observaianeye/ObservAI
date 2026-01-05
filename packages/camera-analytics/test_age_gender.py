
import sys
import os
import cv2
import numpy as np
import logging

# Add package to path
sys.path.append(os.getcwd())

from camera_analytics.age_gender import EstimatorFactory, AgeGenderEstimator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_age_gender")

def test_estimator():
    print("Testing AgeGenderEstimator...")
    
    # 1. Create Estimator
    try:
        estimator = EstimatorFactory.create_estimator()
        estimator.prepare()
        print("✅ Estimator initialized successfully")
    except Exception as e:
        print(f"❌ Estimator initialization failed: {e}")
        return

    # 2. Create a dummy face image (112x112 black square with white circle)
    # Ideally should use a real face, but we test the pipeline crash-safety here.
    # InsightFace might return nothing for a dummy image, which is expected.
    dummy_face = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.circle(dummy_face, (100, 100), 50, (255, 255, 255), -1)
    
    # 3. Predict
    print("Testing prediction on dummy image...")
    age, gender, conf = estimator.predict(dummy_face)
    print(f"Prediction result: Age={age}, Gender={gender}, Conf={conf}")
    
    if age is None:
        print("ℹ️ No face detected in dummy image (Expected)")
    else:
        print("⚠️ Face detected in dummy image (Unexpected but possible for simple detectors)")

    print("✅ Test complete")

if __name__ == "__main__":
    test_estimator()
