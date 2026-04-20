"""
End-to-end YouTube live-stream smoke test for the refreshed demographics pipeline.

Pulls a few frames from a public live cam (Jackson Hole town square — no JS runtime
needed for yt-dlp), runs YOLO11L + InsightFace (buffalo_l, CUDA EP FP32), and writes
an annotated frame so we can manually compare predictions against the screenshot.

Usage:
  venv/Scripts/python scripts/youtube_demographics_test.py
"""

import os
import sys
import cv2
import time
import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PKG_ROOT = os.path.join(REPO_ROOT, "packages", "camera-analytics")
sys.path.insert(0, PKG_ROOT)

from camera_analytics.sources import prepare_source
from camera_analytics.age_gender import InsightFaceEstimator
from ultralytics import YOLO

YT_URL = "https://www.youtube.com/watch?v=1EiC9bvVGnk"  # Jackson Hole town square live
OUT_IMG = os.path.join(REPO_ROOT, "logs", "youtube_test_demographics.jpg")
MODEL_PATH = os.path.join(PKG_ROOT, "yolo11l.pt")
SAMPLE_FRAMES = 60
MIN_VISIBLE_PERSONS = 2


def pick_scene(cap, attempts: int) -> tuple:
    best_frame = None
    best_count = 0
    consecutive_fail = 0
    yolo = YOLO(MODEL_PATH)
    i = 0
    while i < attempts:
        ok, frame = cap.read()
        if not ok or frame is None:
            consecutive_fail += 1
            if consecutive_fail > 50:
                print(f"[ERROR] Too many consecutive read failures at attempt {i}")
                break
            time.sleep(0.2)
            continue
        consecutive_fail = 0
        i += 1
        res = yolo.predict(frame, imgsz=640, conf=0.3, classes=[0], verbose=False)
        if not res:
            continue
        boxes = res[0].boxes
        n = 0 if boxes is None else len(boxes)
        if n > 0 and i % 5 == 0:
            print(f"[INFO] frame {i}: {n} person(s)")
        if n > best_count:
            best_count = n
            best_frame = (frame.copy(), res[0])
            if n >= 4:
                break
    return best_frame, best_count, yolo


def main() -> int:
    print(f"[INFO] Opening stream: {YT_URL}")
    src = prepare_source(YT_URL)
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print("[ERROR] Could not open stream.")
        return 1

    # Warm-up: HLS live streams often need a few seconds before the first chunk resolves.
    warm_ok = 0
    warm_total = 0
    warm_start = time.time()
    while time.time() - warm_start < 20 and warm_ok < 3:
        ok, _ = cap.read()
        warm_total += 1
        if ok:
            warm_ok += 1
        else:
            time.sleep(0.25)
    print(f"[INFO] Warm-up: {warm_ok} good reads / {warm_total} attempts over {time.time()-warm_start:.1f}s")

    print(f"[INFO] Scanning up to {SAMPLE_FRAMES} frames for a scene with >= {MIN_VISIBLE_PERSONS} people")
    picked, count, yolo = pick_scene(cap, SAMPLE_FRAMES)
    cap.release()
    if picked is None or count < MIN_VISIBLE_PERSONS:
        print(f"[WARN] No dense scene found (best count={count}). Saving best frame anyway.")
        if picked is None:
            print("[ERROR] No frames captured at all.")
            return 2
    frame, yolo_res = picked

    print(f"[INFO] YOLO picked frame with {count} person(s). Loading InsightFace...")
    ag = InsightFaceEstimator()
    ag.prepare(ctx_id=0, det_size=(960, 960))
    if ag.app is None:
        print("[ERROR] InsightFace failed to initialize.")
        return 3

    print(f"[INFO] Running face detection on selected frame ({frame.shape[1]}x{frame.shape[0]})")
    faces = ag.app.get(frame)
    print(f"[INFO] InsightFace (full frame) returned {len(faces)} face(s)")

    annotated = frame.copy()

    # YOLO person boxes (red).
    crops_for_ag = []
    if yolo_res.boxes is not None:
        for b in yolo_res.boxes.xyxy.cpu().numpy().astype(int):
            x1, y1, x2, y2 = b
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
            # Crop head region (top 35% of person box, upscaled to >= 320 px) for
            # the crop-based fallback path that the real analytics pipeline uses.
            ph = y2 - y1
            if ph <= 0:
                continue
            head_y2 = y1 + max(1, int(ph * 0.35))
            head_crop = frame[max(0, y1):head_y2, max(0, x1):x2]
            if head_crop.size == 0:
                continue
            crops_for_ag.append(((x1, y1, x2, head_y2), head_crop))

    # If the full-frame pass missed everyone (tiny faces), try the crop path.
    if len(faces) == 0 and crops_for_ag:
        print(f"[INFO] Full-frame pass found no faces. Probing {len(crops_for_ag)} head crops with InsightFace...")
        synth_faces = []
        for (box, crop) in crops_for_ag:
            upscaled = ag._upscale_if_needed(crop)
            enhanced = ag._enhance_contrast(upscaled)
            sub = ag.app.get(enhanced)
            if not sub:
                continue
            # Translate bbox back into original frame coords for annotation.
            best = max(sub, key=lambda f: float(getattr(f, 'det_score', 0.0)))
            scale_x = crop.shape[1] / enhanced.shape[1] if enhanced.shape[1] else 1.0
            scale_y = crop.shape[0] / enhanced.shape[0] if enhanced.shape[0] else 1.0
            fx1, fy1, fx2, fy2 = best.bbox
            gx1 = int(box[0] + fx1 * scale_x)
            gy1 = int(box[1] + fy1 * scale_y)
            gx2 = int(box[0] + fx2 * scale_x)
            gy2 = int(box[1] + fy2 * scale_y)

            class _SynthFace:
                pass
            sf = _SynthFace()
            sf.bbox = np.array([gx1, gy1, gx2, gy2], dtype=np.float32)
            sf.age = getattr(best, 'age', None)
            sf.gender = getattr(best, 'gender', None)
            sf.sex = getattr(best, 'sex', None)
            sf.det_score = getattr(best, 'det_score', 0.0)
            synth_faces.append(sf)
        faces = synth_faces
        print(f"[INFO] Crop-fallback found {len(faces)} face(s)")

    # Demographic band labels (green text + yellow box on faces).
    LO = 0.35
    HI = 0.65
    for i, face in enumerate(faces):
        x1, y1, x2, y2 = face.bbox.astype(int)
        age = float(getattr(face, "age", 0)) if getattr(face, "age", None) is not None else None
        gscore = None
        if hasattr(face, "gender") and face.gender is not None:
            gscore = float(face.gender)
        elif hasattr(face, "sex"):
            gscore = 1.0 if face.sex == "M" else 0.0

        if gscore is None:
            gender_label = "?"
            band = "nofield"
        elif gscore >= HI:
            gender_label = "M"
            band = "hi"
        elif gscore <= LO:
            gender_label = "F"
            band = "lo"
        else:
            gender_label = "?"
            band = "mid"

        det_score = float(getattr(face, "det_score", 0.0))
        age_str = f"{age:.0f}" if age is not None else "-"
        label = f"#{i} {gender_label} age={age_str} det={det_score:.2f} band={band}"
        print(f"[FACE {i}] gscore={gscore} age={age_str} det={det_score:.2f} band={band} bbox=({x1},{y1},{x2},{y2})")

        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 255), 2)
        cv2.putText(
            annotated,
            label,
            (x1, max(15, y1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 255, 0),
            1,
            cv2.LINE_AA,
        )

    os.makedirs(os.path.dirname(OUT_IMG), exist_ok=True)
    cv2.imwrite(OUT_IMG, annotated)
    print(f"[OK] Saved annotated frame -> {OUT_IMG}")
    print(f"[SUMMARY] persons={count} faces={len(faces)} hi-band={sum(1 for f in faces if float(getattr(f, 'gender', 0.5) or 0.5) >= HI)} lo-band={sum(1 for f in faces if float(getattr(f, 'gender', 0.5) or 0.5) <= LO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
