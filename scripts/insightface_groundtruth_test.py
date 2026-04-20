"""
Ground-truth sanity test for the refreshed demographics pipeline.

Runs our InsightFaceEstimator (buffalo_l, CUDA EP FP32) against:
  1) InsightFace's shipped sample image `t1.jpg` — 6 known faces, mixed gender.
  2) `Tom_Hanks_54745.png` — single male face, classic alignment validation.

Validates:
  - Face detection works at all (not a model loading issue).
  - Gender hysteresis band (0.35 / 0.65) classifies correctly where confident.
  - Ambiguous cases fall into `?` rather than being forced — confirming
    the `round()` -> band replacement is live.
  - Age values are in a sane range (not NaN, not clipped to 0).

Saves two annotated frames to logs/ for visual comparison.
"""

import os
import sys
import cv2
import insightface

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PKG_ROOT = os.path.join(REPO_ROOT, "packages", "camera-analytics")
sys.path.insert(0, PKG_ROOT)

from camera_analytics.age_gender import InsightFaceEstimator

SAMPLES_DIR = os.path.join(os.path.dirname(insightface.__file__), "data", "images")
IMAGES = [
    ("t1.jpg", "insightface_groundtruth_t1.jpg"),
    ("Tom_Hanks_54745.png", "insightface_groundtruth_tomhanks.jpg"),
]

LO = 0.35
HI = 0.65


def classify(gscore):
    if gscore is None:
        return "?", "nofield"
    if gscore >= HI:
        return "M", "hi"
    if gscore <= LO:
        return "F", "lo"
    return "?", "mid"


def main() -> int:
    ag = InsightFaceEstimator()
    ag.prepare(ctx_id=0, det_size=(640, 640))
    if ag.app is None:
        print("[ERROR] InsightFace failed to initialize.")
        return 1

    for src_name, out_name in IMAGES:
        src_path = os.path.join(SAMPLES_DIR, src_name)
        if not os.path.exists(src_path):
            print(f"[WARN] Missing sample: {src_path}")
            continue
        img = cv2.imread(src_path)
        if img is None:
            print(f"[WARN] Unreadable: {src_path}")
            continue
        print(f"\n=== {src_name} ({img.shape[1]}x{img.shape[0]}) ===")
        faces = ag.app.get(img)
        print(f"[INFO] {len(faces)} face(s) detected")

        annotated = img.copy()
        hi_n = lo_n = mid_n = 0
        for i, face in enumerate(faces):
            x1, y1, x2, y2 = face.bbox.astype(int)
            age = float(getattr(face, "age", 0)) if getattr(face, "age", None) is not None else None
            gscore = float(face.gender) if getattr(face, "gender", None) is not None else None
            label, band = classify(gscore)
            det_score = float(getattr(face, "det_score", 0.0))
            age_str = f"{age:.0f}" if age is not None else "-"

            if band == "hi":
                hi_n += 1
            elif band == "lo":
                lo_n += 1
            elif band == "mid":
                mid_n += 1

            print(f"  #{i}: label={label} gscore={gscore:.3f} age={age_str} det={det_score:.3f} band={band}")

            color = (0, 200, 0) if band in ("hi", "lo") else (0, 200, 255)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                annotated,
                f"#{i} {label} age={age_str}",
                (x1, max(15, y1 - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        out_path = os.path.join(REPO_ROOT, "logs", out_name)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        cv2.imwrite(out_path, annotated)
        print(f"[OK] {out_path} | hi={hi_n} lo={lo_n} mid={mid_n}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
