"""
Modern Glass-morphism Overlay Visualization System
Keyboard shortcuts:
  - H: Toggle heatmap overlay
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class OverlayState:
    """Manages overlay panel visibility"""
    heatmap_visible: bool = False
    animation_progress: float = 1.0
        
    def toggle_heatmap(self):
        self.heatmap_visible = not self.heatmap_visible


class GlassOverlay:
    """Modern glass-morphism overlay renderer"""
    
    # Glass-morphism color scheme
    GLASS_BG = (25, 25, 35)  # Dark glass background
    GLASS_BORDER = (100, 100, 150)  # Subtle purple border
    ACCENT_PRIMARY = (147, 112, 219)  # Medium Purple
    ACCENT_SUCCESS = (100, 255, 150)  # Bright Green
    ACCENT_WARNING = (255, 200, 100)  # Warm Orange
    ACCENT_INFO = (100, 200, 255)  # Sky Blue
    TEXT_PRIMARY = (255, 255, 255)  # White
    TEXT_SECONDARY = (180, 180, 200)  # Light Gray
    
    def __init__(self, frame_width: int, frame_height: int):
        self.width = frame_width
        self.height = frame_height
        self.state = OverlayState()
        
    def draw_glass_panel(
        self,
        frame: np.ndarray,
        x: int,
        y: int,
        width: int,
        height: int,
        alpha: float = 0.85,
        blur_strength: int = 15
    ) -> np.ndarray:
        """Draw a modern glass-morphism panel"""
        overlay = frame.copy()
        
        # Create rounded rectangle mask
        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.rectangle(mask, (0, 0), (width, height), 255, -1)
        
        # Background with blur effect
        roi = frame[y:y+height, x:x+width]
        blurred = cv2.GaussianBlur(roi, (blur_strength, blur_strength), 0)
        
        # Apply glass background color
        glass_bg = np.full_like(roi, self.GLASS_BG, dtype=np.uint8)
        blended = cv2.addWeighted(blurred, 0.3, glass_bg, 0.7, 0)
        
        # Place back on overlay
        overlay[y:y+height, x:x+width] = blended
        
        # Draw border with glow effect
        cv2.rectangle(overlay, (x, y), (x + width, y + height), self.GLASS_BORDER, 2)
        cv2.rectangle(overlay, (x-1, y-1), (x + width+1, y + height+1), 
                     tuple(int(c * 0.5) for c in self.GLASS_BORDER), 1)
        
        # Blend with original
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        
        return frame
    
    def draw_animated_number(
        self,
        frame: np.ndarray,
        x: int,
        y: int,
        value: int,
        label: str,
        color: Tuple[int, int, int],
        font_scale: float = 1.0
    ):
        """Draw animated number with label"""
        # Draw value (use SIMPLEX with higher thickness for bold effect)
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(frame, str(value), (x, y), font, font_scale * 1.2, color, 3)
        
        # Draw label below
        cv2.putText(frame, label, (x, y + 30), cv2.FONT_HERSHEY_SIMPLEX, 
                   font_scale * 0.4, self.TEXT_SECONDARY, 1)
    
    def draw_progress_bar(
        self,
        frame: np.ndarray,
        x: int,
        y: int,
        width: int,
        height: int,
        progress: float,
        color: Tuple[int, int, int]
    ):
        """Draw modern progress bar"""
        # Background
        cv2.rectangle(frame, (x, y), (x + width, y + height), (50, 50, 60), -1)
        
        # Progress fill
        fill_width = int(width * min(max(progress, 0), 1))
        if fill_width > 0:
            cv2.rectangle(frame, (x, y), (x + fill_width, y + height), color, -1)
            
        # Glow effect
        cv2.rectangle(frame, (x, y), (x + fill_width, y + height), 
                     tuple(min(c + 50, 255) for c in color), 1)
    
    def draw_heatmap_overlay(self, frame: np.ndarray, metrics: Dict):
        """Draw heatmap visualization overlay (Bottom)"""
        if not self.state.heatmap_visible:
            return
            
        heatmap_data = metrics.get('heatmap', [])
        if not heatmap_data:
            return
        
        # Create heatmap overlay
        overlay = frame.copy()
        
        # Find max intensity for normalization
        max_intensity = max(max(row) if row else 0 for row in heatmap_data)
        if max_intensity == 0:
            return
        
        cell_height = self.height // len(heatmap_data)
        cell_width = self.width // len(heatmap_data[0]) if heatmap_data else self.width
        
        for y, row in enumerate(heatmap_data):
            for x, intensity in enumerate(row):
                if intensity > 0:
                    # Normalize intensity
                    norm_intensity = intensity / max_intensity
                    
                    # Create heat color (blue -> purple -> red)
                    if norm_intensity < 0.5:
                        color = (255, int(norm_intensity * 400), 100)  # Blue to Purple
                    else:
                        color = (int((1 - norm_intensity) * 200), 100, 255)  # Purple to Red
                    
                    # Draw heat cell
                    x1 = x * cell_width
                    y1 = y * cell_height
                    x2 = x1 + cell_width
                    y2 = y1 + cell_height
                    
                    cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
        
        # Blend heatmap
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        
        # Draw heatmap legend
        legend_x = self.width - 250
        legend_y = self.height - 80
        self.draw_glass_panel(frame, legend_x, legend_y, 230, 60, alpha=0.9)
        
        cv2.putText(frame, "HEATMAP", (legend_x + 15, legend_y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.TEXT_PRIMARY, 1)
        
        # Color gradient bar
        gradient_y = legend_y + 40
        for i in range(150):
            norm = i / 150
            if norm < 0.5:
                color = (255, int(norm * 400), 100)
            else:
                color = (int((1 - norm) * 200), 100, 255)
            cv2.line(frame, (legend_x + 15 + i, gradient_y), 
                    (legend_x + 15 + i, gradient_y + 10), color, 2)
        
        cv2.putText(frame, "Low", (legend_x + 15, gradient_y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.35, self.TEXT_SECONDARY, 1)
        cv2.putText(frame, "High", (legend_x + 145, gradient_y + 25),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.35, self.TEXT_SECONDARY, 1)
    
    def render(self, frame: np.ndarray, metrics: Dict) -> np.ndarray:
        """Render all visible overlays"""
        self.draw_heatmap_overlay(frame, metrics)
        return frame
    
    def handle_key(self, key: int) -> bool:
        """Handle keyboard input for toggling panels"""
        if key == ord('h') or key == ord('H'):
            self.state.toggle_heatmap()
            return True
        return False
