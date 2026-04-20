
import logging
import time
import sys
import os
from abc import ABC, abstractmethod
from typing import Tuple, Optional, Any
import numpy as np
import cv2
import torch

# Add package to path if needed
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
MIVOLO_REPO_DIR = os.path.join(PARENT_DIR, "mivolo_repo")

# --- MONKEY PATCH FOR TIMM / MiVOLO COMPATIBILITY ---
try:
    import timm.models._helpers
    if not hasattr(timm.models._helpers, 'remap_checkpoint'):
        def remap_checkpoint(model, checkpoint, *args, **kwargs):
            return checkpoint
        timm.models._helpers.remap_checkpoint = remap_checkpoint
        logging.getLogger(__name__).info("Patched timm.models._helpers.remap_checkpoint")

    import timm.models._pretrained
    if not hasattr(timm.models._pretrained, 'split_model_name_tag'):
        def split_model_name_tag(model_name):
            if ':' in model_name:
                return model_name.split(':', 1)
            return model_name, None
        timm.models._pretrained.split_model_name_tag = split_model_name_tag
        logging.getLogger(__name__).info("Patched timm.models._pretrained.split_model_name_tag")

except ImportError:
    pass
# ----------------------------------------------------

if MIVOLO_REPO_DIR not in sys.path:
    sys.path.append(MIVOLO_REPO_DIR)


# Try to import InsightFace dependencies safely
try:
    import insightface
    from insightface.app import FaceAnalysis
except ImportError:
    insightface = None
    FaceAnalysis = None

logger = logging.getLogger(__name__)

class AgeGenderEstimator(ABC):
    """
    Abstract base class for Age and Gender estimation models.
    """
    
    @abstractmethod
    def prepare(self, ctx_id: int = 0, det_size: Tuple[int, int] = (640, 640)) -> None:
        """Initialize the model."""
        pass

    @abstractmethod
    def predict(self, face_img: np.ndarray) -> Tuple[Optional[float], Optional[str], float]:
        """
        Predict age and gender from a cropped face image.
        Returns: (age, gender, confidence)
        """
        pass

class MiVOLOEstimator(AgeGenderEstimator):
    """
    MiVOLO (Multi-input VOLO) for age/gender estimation.
    v2: Age MAE ~3.5yr, Gender ~97-98%. 384x384 input, trained on 807K samples.
    v1: Age MAE ~3.7yr, Gender ~97%. 224x224 input.
    Uses face+body dual 6-channel input for robust predictions.
    Can predict body-only when face is not visible.
    """

    # Model filenames (v2 preferred over v1)
    DEFAULT_MODEL_V2_DIR = "mivolo_v2"
    DEFAULT_MODEL_V1 = "mivolo_d1_imdb.pth.tar"

    # Architecture params for mivolo_d1 variant (shared by v1 and v2)
    ARCH_PARAMS = dict(
        layers=(4, 4, 8, 2),
        embed_dims=(192, 384, 384, 384),
        num_heads=(6, 12, 12, 12),
    )

    def __init__(self, model_path: str = None, device: str = None):
        env_path = os.environ.get("MIVOLO_MODEL_PATH")
        if env_path and os.path.exists(env_path):
            self.model_path = env_path
        elif model_path and os.path.exists(model_path):
            self.model_path = model_path
        else:
            # Prefer v2 (safetensors) over v1 (.pth.tar)
            v2_dir = os.path.join(PARENT_DIR, "models", self.DEFAULT_MODEL_V2_DIR)
            v2_safetensors = os.path.join(v2_dir, "model.safetensors")
            if os.path.exists(v2_safetensors):
                self.model_path = v2_safetensors
            else:
                self.model_path = os.path.join(PARENT_DIR, "models", self.DEFAULT_MODEL_V1)

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.meta = None  # min_age, max_age, avg_age
        self.input_size = 224
        self._mean = None
        self._std = None
        self._half = self.device != "cpu"
        self._version = "v1"  # will be set during prepare()

    def _load_safetensors(self):
        """Load MiVOLOv2 from safetensors + config.json format."""
        import json
        from safetensors.torch import load_file

        config_path = os.path.join(os.path.dirname(self.model_path), "config.json")
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"config.json not found alongside {self.model_path}")

        with open(config_path) as f:
            config = json.load(f)

        self.meta = {
            "min_age": config.get("min_age", 0),
            "max_age": config.get("max_age", 122),
            "avg_age": config.get("avg_age", 61.0),
        }
        self.input_size = config.get("input_size", 384)
        in_chans = config.get("in_chans", 6)
        num_classes = config.get("num_classes", 3)

        # Load safetensors and strip HuggingFace wrapper prefix
        raw_sd = load_file(self.model_path, device="cpu")
        sd = {}
        for k, v in raw_sd.items():
            # Strip "mivolo.model." prefix from HuggingFace wrapper
            clean_key = k.replace("mivolo.model.", "")
            if "fds." not in clean_key:
                sd[clean_key] = v

        self._version = "v2"
        return sd, in_chans, num_classes

    def _load_pth_tar(self):
        """Load MiVOLOv1 from .pth.tar checkpoint format."""
        state = torch.load(self.model_path, map_location="cpu")
        self.meta = {
            "min_age": state["min_age"],
            "max_age": state["max_age"],
            "avg_age": state["avg_age"],
        }
        sd = state["state_dict"]
        in_chans = 6 if "patch_embed.conv1.0.weight" in sd else 3
        num_classes = 1 if state.get("no_gender", False) else 3
        self.input_size = sd["pos_embed"].shape[1] * 16

        clean_sd = {k: v for k, v in sd.items() if "fds." not in k}
        self._version = "v1"
        return clean_sd, in_chans, num_classes

    def prepare(self, ctx_id: int = 0, det_size: Tuple[int, int] = (640, 640)) -> None:
        if not os.path.exists(self.model_path):
            logger.warning(f"MiVOLO weights not found: {self.model_path}")
            return

        try:
            from mivolo.model.mivolo_model import MiVOLOModel
            from timm.data import IMAGENET_DEFAULT_MEAN, IMAGENET_DEFAULT_STD

            logger.info(f"Loading MiVOLO from {self.model_path} on {self.device}")

            # Load checkpoint (auto-detect format)
            if self.model_path.endswith(".safetensors"):
                sd, in_chans, num_classes = self._load_safetensors()
            else:
                sd, in_chans, num_classes = self._load_pth_tar()

            # Create model directly (bypass timm build_model_with_cfg)
            self.model = MiVOLOModel(
                **self.ARCH_PARAMS,
                img_size=self.input_size,
                in_chans=in_chans,
                num_classes=num_classes,
            )

            self.model.load_state_dict(sd, strict=False)
            self.model = self.model.to(self.device).eval()
            if self._half:
                self.model = self.model.half()

            self._mean = IMAGENET_DEFAULT_MEAN
            self._std = IMAGENET_DEFAULT_STD

            # Warmup
            dummy = torch.randn(1, in_chans, self.input_size, self.input_size).to(self.device)
            if self._half:
                dummy = dummy.half()
            with torch.no_grad():
                for _ in range(3):
                    self.model(dummy)
            if torch.cuda.is_available():
                torch.cuda.synchronize()

            params = sum(p.numel() for p in self.model.parameters())
            precision = "FP16" if self._half else "FP32"
            msg = (f"MiVOLO {self._version} ready: {params:,} params, input={self.input_size}, "
                   f"in_chans={in_chans}, age=[{self.meta['min_age']}-{self.meta['max_age']}], "
                   f"device={self.device}, {precision}")
            logger.info(msg)
            print(f"[MIVOLO] ✅ {msg}", flush=True)

        except Exception as e:
            logger.error(f"MiVOLO load failed: {e}")
            import traceback; traceback.print_exc()
            self.model = None

    def _prep_images(self, img_list):
        """Preprocess a list of Optional[np.ndarray] into a batched tensor."""
        from mivolo.data.misc import prepare_classification_images
        return prepare_classification_images(
            img_list, self.input_size, self._mean, self._std, device=self.device
        )

    def _decode(self, output, index=0):
        """Decode MiVOLO output at batch index into (age, gender, gender_prob)."""
        age_raw = output[index, 2].item()
        age = age_raw * (self.meta["max_age"] - self.meta["min_age"]) + self.meta["avg_age"]
        age = max(1.0, min(95.0, age))

        gender_logits = output[index, :2].softmax(-1)
        male_prob = gender_logits[0].item()
        female_prob = gender_logits[1].item()
        gender_prob = max(male_prob, female_prob)

        # Hysteresis band: require clear evidence before committing to a gender.
        # Probabilities hugging 50/50 almost always come from ambiguous crops
        # (very small, occluded, or heavy side pose). Returning None keeps the
        # vote neutral; the tracker's temporal consensus picks it up next frame.
        if male_prob >= 0.65:
            gender = "male"
        elif female_prob >= 0.65:
            gender = "female"
        else:
            gender = None

        return float(age), gender, float(gender_prob)

    def predict_batch(self, face_crops, body_crops):
        """
        Batch age/gender prediction from face+body crop pairs.

        Args:
            face_crops: list of Optional[np.ndarray] — face crop or None
            body_crops: list of Optional[np.ndarray] — body crop or None

        Returns:
            list of (age, gender, gender_prob) tuples.
            gender_prob is CONTINUOUS [0.5, 1.0] — the model's actual confidence.
        """
        if self.model is None or len(face_crops) == 0:
            return [(None, None, 0.0)] * len(face_crops)

        try:
            faces_t = self._prep_images(face_crops)
            bodies_t = self._prep_images(body_crops)

            if faces_t is None and bodies_t is None:
                return [(None, None, 0.0)] * len(face_crops)

            # 6-channel concat: [face_3ch, body_3ch]
            model_input = torch.cat((faces_t, bodies_t), dim=1)
            with torch.no_grad():
                if self._half:
                    model_input = model_input.half()
                output = self.model(model_input)

            results = []
            for i in range(output.shape[0]):
                results.append(self._decode(output, i))
            return results

        except Exception as e:
            logger.error(f"MiVOLO batch error: {e}")
            return [(None, None, 0.0)] * len(face_crops)

    def predict(self, face_img: np.ndarray) -> Tuple[Optional[float], Optional[str], float]:
        """Single face-only prediction (crop fallback compatibility)."""
        results = self.predict_batch([face_img], [face_img])
        return results[0]

    def detect_and_predict(self, full_frame: np.ndarray) -> Any:
        # MiVOLO doesn't do face detection — InsightFace handles that
        return []


class InsightFaceEstimator(AgeGenderEstimator):
    """
    Optimized InsightFace wrapper using buffalo_l for highest accuracy.
    buffalo_l provides significantly better age/gender prediction than buffalo_s,
    especially for profile faces and low-resolution crops.

    TensorRT acceleration:
    - ONNX Runtime's TensorrtExecutionProvider is used when available
    - First run compiles TRT engines (~1-2 min), cached for subsequent runs
    - FP16 inference for ~2x speedup over CUDA EP
    - Falls back to CUDAExecutionProvider if TRT fails
    """
    MIN_FACE_INPUT_SIZE = 320

    def __init__(self, model_name: str = "buffalo_l", providers: list = None):
        self.model_name = model_name
        if providers is None:
            import platform as _platform
            _system = _platform.system()
            if _system == "Darwin":
                self.providers = ["CoreMLExecutionProvider", "CPUExecutionProvider"]
            else:
                # CUDA EP for InsightFace — TensorRT EP FP16 damages gender accuracy
                # on the small genderage model (96x96) and adds overhead for dynamic
                # shape models (det_10g). YOLO uses TRT engine separately.
                self.providers = [
                    ("CUDAExecutionProvider", {
                        "device_id": "0",
                        "cudnn_conv_algo_search": "EXHAUSTIVE",
                        "cudnn_conv_use_max_workspace": "1",
                    }),
                    ("CPUExecutionProvider", {}),
                ]
                print(f"[INFO] InsightFace providers: CUDA (FP32 for gender accuracy) > CPU")
        else:
            self.providers = providers
        self.app = None

    def prepare(self, ctx_id: int = 0, det_size: Tuple[int, int] = (640, 640)) -> None:
        if FaceAnalysis is None:
            logger.error("InsightFace library not found.")
            return

        # Skip recognition model — we use MiVOLO for age/gender, InsightFace only for detection.
        # This saves ~250MB memory and ~5ms/frame (no embedding extraction).
        _allowed = ['detection', 'genderage']
        logger.info(f"Initializing InsightFace ({self.model_name}) modules={_allowed} with CUDA EP")
        try:
            self.app = FaceAnalysis(name=self.model_name, providers=self.providers,
                                    allowed_modules=_allowed)
            self.app.prepare(ctx_id=ctx_id, det_size=det_size)
            logger.info(f"InsightFace ({self.model_name}) initialized successfully.")
            # Log loaded model names and active providers
            try:
                if self.app and hasattr(self.app, 'models'):
                    model_names = list(self.app.models.keys()) if isinstance(self.app.models, dict) else [str(m) for m in self.app.models]
                    print(f"[INFO] InsightFace loaded models: {model_names}")
                    # Check for genderage model availability
                    has_genderage = any('genderage' in str(name) for name in model_names)
                    if not has_genderage:
                        print(f"[WARN] 'genderage' model NOT found in InsightFace! Age/gender will NOT work.")
                    # Log which EP each model session is actually using
                    for mname, model_obj in (self.app.models.items() if isinstance(self.app.models, dict) else []):
                        if hasattr(model_obj, 'session') and hasattr(model_obj.session, 'get_providers'):
                            active_eps = model_obj.session.get_providers()
                            print(f"[INFO] Model '{mname}' active providers: {active_eps}")
            except Exception as e:
                print(f"[INFO] InsightFace models loaded (could not enumerate: {e})")
        except Exception as e:
            logger.error(f"Failed to initialize InsightFace ({self.model_name}): {e}")
            # Fallback chain: buffalo_l CUDA → buffalo_s CUDA → CPU
            if self.model_name == "buffalo_l":
                logger.warning("buffalo_l failed, trying buffalo_s as fallback...")
                try:
                    self.model_name = "buffalo_s"
                    self.app = FaceAnalysis(name="buffalo_s", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
                    self.app.prepare(ctx_id=ctx_id, det_size=det_size)
                    logger.info("InsightFace (buffalo_s fallback) initialized successfully.")
                    return
                except Exception:
                    pass
            if "CPUExecutionProvider" not in str(self.providers):
                logger.warning("Falling back to CPUExecutionProvider...")
                self.providers = ["CPUExecutionProvider"]
                self.app = FaceAnalysis(name=self.model_name, providers=self.providers)
                self.app.prepare(ctx_id=ctx_id, det_size=det_size)

    def _upscale_if_needed(self, img: np.ndarray) -> np.ndarray:
        """Upscale small crops so InsightFace's detector can find faces reliably."""
        h, w = img.shape[:2]
        min_dim = min(h, w)
        if min_dim < self.MIN_FACE_INPUT_SIZE:
            scale = self.MIN_FACE_INPUT_SIZE / min_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        return img

    def _enhance_contrast(self, img: np.ndarray) -> np.ndarray:
        """
        CLAHE (Contrast Limited Adaptive Histogram Equalization) ile kontrast iyileştir.
        Düşük ışık ve düşük kaliteli video kaynaklarında yüz tespitini iyileştirir.
        Özellikle iPhone/YouTube gibi kaynaklar için kritik.
        """
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l_ch, a_ch, b_ch = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l_enhanced = clahe.apply(l_ch)
            enhanced = cv2.merge([l_enhanced, a_ch, b_ch])
            return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        except Exception:
            return img  # Hata durumunda orijinal görüntüyü döndür

    def predict(self, face_img: np.ndarray) -> Tuple[Optional[float], Optional[str], float]:
        if self.app is None:
            return None, None, 0.0

        try:
            processed = self._upscale_if_needed(face_img)
            # NOTE: CLAHE removed — adds ~3ms per crop and introduces noise that
            # can confuse gender prediction. InsightFace works well on raw input.
            faces = self.app.get(processed)
            if not faces:
                return None, None, 0.0

            face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

            det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.0
            if det_score < 0.25:
                return None, None, 0.0

            age = float(face.age) if face.age is not None else None

            # --- Gender decoding with hysteresis band ---
            # Raw score is in [0, 1]; values in the middle are ambiguous.
            # Return None (vs. forcing a decision) so the caller can skip this frame.
            gender = None
            gender_score = None
            if hasattr(face, "gender") and face.gender is not None:
                gender_score = float(face.gender)
            elif hasattr(face, "sex"):
                if isinstance(face.sex, str):
                    gender = "male" if face.sex.upper() == 'M' else "female"
                else:
                    gender_score = float(face.sex)

            if gender_score is not None:
                if gender_score >= 0.65:
                    gender = "male"
                elif gender_score <= 0.35:
                    gender = "female"

            # Quality-based confidence: large frontal faces = high weight,
            # small/side faces = lower weight (but still contribute to voting)
            face_w = face.bbox[2] - face.bbox[0]
            face_h = face.bbox[3] - face.bbox[1]
            face_area = face_w * face_h
            img_area = processed.shape[0] * processed.shape[1]
            size_factor = min(1.0, max(0.3, (face_area / max(1, img_area)) / 0.01))

            # Pose-based confidence: softer penalty so moderate side poses still vote.
            pose_factor = 0.75
            yaw = 30.0
            if hasattr(face, 'pose') and face.pose is not None:
                yaw = abs(float(face.pose[1]))
                pose_factor = max(0.25, 1.0 - yaw / 110.0)

            # Suppress gender only for severe profile poses (relaxed from 55° to 70°).
            if yaw > 70.0:
                gender = None

            confidence = 0.85 * min(1.0, det_score / 0.5) * size_factor * pose_factor
            confidence = max(0.10, min(0.95, confidence))

            logger.debug(
                f"InsightFace predict: age={age:.1f if age else 'N/A'}, "
                f"gender={gender}, det_score={det_score:.3f}, gender_conf={confidence:.3f}"
            )

            return age, gender, confidence

        except Exception as e:
            logger.debug(f"InsightFace predict exception: {e}")
            return None, None, 0.0

    def detect_and_predict(self, full_frame: np.ndarray) -> Any:
         return self.app.get(full_frame)


class EstimatorFactory:
    """
    Creates demographics estimators.
    In 'auto' mode: InsightFace for face detection, MiVOLO for age/gender.
    """

    @staticmethod
    def _find_mivolo_weights() -> Optional[str]:
        """Search for MiVOLO weights. Prefers v2 (safetensors) over v1 (.pth.tar)."""
        candidates = [
            os.environ.get("MIVOLO_MODEL_PATH", ""),
            # v2 safetensors (preferred — better accuracy)
            os.path.join(PARENT_DIR, "models", MiVOLOEstimator.DEFAULT_MODEL_V2_DIR, "model.safetensors"),
            # v1 .pth.tar (fallback)
            os.path.join(PARENT_DIR, "models", MiVOLOEstimator.DEFAULT_MODEL_V1),
            os.path.join(PARENT_DIR, "models", "mivolo_model.pth"),
        ]
        for p in candidates:
            if p and os.path.exists(p):
                return p
        return None

    @staticmethod
    def create_estimator(config: dict = None) -> AgeGenderEstimator:
        """Create a face detector + demographics estimator (backward compat)."""
        if config is None:
            config = {}

        model_type = config.get("model_type", "auto")

        if model_type == "insightface":
            logger.info("Factory: Creating InsightFace Estimator...")
            return InsightFaceEstimator()

        if model_type == "mivolo":
            path = EstimatorFactory._find_mivolo_weights()
            logger.info(f"Factory: Creating MiVOLO Estimator (weights={path})")
            return MiVOLOEstimator(model_path=path)

        # "auto" mode: InsightFace for face detection (always needed)
        if insightface is not None:
            logger.info("Factory: Creating InsightFace Estimator (face detection)...")
            estimator = InsightFaceEstimator()
            print(f"[INFO] Factory selected: {type(estimator).__name__}")
            return estimator

        logger.warning("Factory: No demographics estimator available")
        return InsightFaceEstimator()

    @staticmethod
    def create_mivolo(device: str = None) -> Optional[MiVOLOEstimator]:
        """Create MiVOLO estimator if weights are available."""
        path = EstimatorFactory._find_mivolo_weights()
        if path is None:
            logger.info("Factory: MiVOLO weights not found, skipping")
            return None
        try:
            from mivolo.model.mivolo_model import MiVOLOModel  # noqa: F401
        except ImportError:
            logger.info("Factory: MiVOLO module not importable, skipping")
            return None
        logger.info(f"Factory: Creating MiVOLO age/gender model (weights={path})")
        return MiVOLOEstimator(model_path=path, device=device)