"""ObservAI camera analytics package."""

from .config import AnalyticsConfig, load_config
from .run import main

__all__ = ["AnalyticsConfig", "load_config", "main"]
