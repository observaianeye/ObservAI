
import sys
import os
import numpy as np
import cv2

try:
    from insightface.app import FaceAnalysis
    print("InsightFace imported successfully")
except ImportError as e:
    print(f"Failed to import InsightFace: {e}")
    sys.exit(1)

try:
    app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(320, 320))
    print("InsightFace initialized successfully")
    
    # Create a dummy image
    img = np.zeros((640, 640, 3), dtype=np.uint8)
    faces = app.get(img)
    print(f"Inference successful (found {len(faces)} faces in blank image)")
    
except Exception as e:
    print(f"InsightFace error: {e}")
    sys.exit(1)
