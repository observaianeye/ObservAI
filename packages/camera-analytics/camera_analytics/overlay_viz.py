"""
Modern Glass-morphism Overlay Visualization System
Keyboard shortcuts:
  - G: Toggle main stats panel
  - H: Toggle heatmap overlay
  - D: Toggle demographics panel  
  - A: Toggle all panels
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class OverlayState:
    """Manages overlay panel visibility"""
    stats_visible: bool = True
    heatmap_visible: bool = False
    demographics_visible: bool = False
    animation_progress: float = 1.0
    
    def toggle_stats(self):
        self.stats_visible = not self.stats_visible
        
    def toggle_heatmap(self):
        self.heatmap_visible = not self.heatmap_visible
        
    def toggle_demographics(self):
        self.demographics_visible = not self.demographics_visible
        
    def toggle_all(self):
        """Toggle all panels"""
        all_on = self.stats_visible and self.heatmap_visible and self.demographics_visible
        new_state = not all_on
        self.stats_visible = new_state
        self.heatmap_visible = new_state
        self.demographics_visible = new_state


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
    
    def draw_stats_panel(self, frame: np.ndarray, metrics: Dict):
        """Draw main statistics panel (Top-Left)"""
        if not self.state.stats_visible:
            return
            
        panel_x, panel_y = 20, 20
        panel_w, panel_h = 380, 320
        
        # Draw glass panel
        self.draw_glass_panel(frame, panel_x, panel_y, panel_w, panel_h)
        
        # Title with glow
        cv2.putText(frame, "LIVE ANALYTICS", (panel_x + 20, panel_y + 40),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, self.ACCENT_PRIMARY, 3)
        
        # Stats grid
        stats = [
            (metrics.get('peopleIn', 0), "ENTRIES", self.ACCENT_SUCCESS, panel_x + 30, panel_y + 90),
            (metrics.get('peopleOut', 0), "EXITS", self.ACCENT_WARNING, panel_x + 30, panel_y + 150),
            (metrics.get('current', 0), "CURRENT", self.ACCENT_INFO, panel_x + 210, panel_y + 90),
            (metrics.get('queue', {}).get('current', 0), "QUEUE", self.ACCENT_WARNING, panel_x + 210, panel_y + 150),
        ]
        
        for value, label, color, x, y in stats:
            self.draw_animated_number(frame, x, y, value, label, color, 0.9)
        
        # Active people list (top 3 by dwell)
        active_people = metrics.get('activePeople', [])
        if active_people:
            sorted_people = sorted(
                active_people,
                key=lambda p: p.get('dwellSeconds', 0),
                reverse=True
            )[:3]
            list_y = panel_y + 200
            cv2.putText(frame, "TOP DWELLERS", (panel_x + 20, list_y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, self.TEXT_PRIMARY, 1)
            list_y += 24
            for person in sorted_people:
                gender = person.get('gender')
                gender_display = "E" if gender == "male" else "K" if gender == "female" else "-"
                age_bucket = person.get('ageBucket') or "unknown"
                category_display = {
                    "child": "Çocuk",
                    "young": "Genç",
                    "middleage": "Orta",
                    "old": "Yaşlı",
                    "elderly": "İhtiyar",
                }.get(age_bucket, "Bilinmiyor")
                dwell = int(person.get('dwellSeconds', 0))
                line = f"ID {person.get('id')} • {dwell} sn • {category_display} • {gender_display}"
                cv2.putText(frame, line, (panel_x + 20, list_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, self.TEXT_SECONDARY, 1)
                list_y += 22

        # Timestamp / shortcuts
        cv2.putText(frame, "PRESS: G-Stats | H-Heat | D-Demo | A-All",
                   (panel_x + 20, panel_y + panel_h - 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.35, self.TEXT_SECONDARY, 1)
    
    def draw_demographics_panel(self, frame: np.ndarray, metrics: Dict):
        """Draw demographics panel (Top-Right)"""
        if not self.state.demographics_visible:
            return
            
        panel_w, panel_h = 340, 450  # Increased height for 5 age categories
        panel_x = self.width - panel_w - 20
        panel_y = 20
        
        # Draw glass panel
        self.draw_glass_panel(frame, panel_x, panel_y, panel_w, panel_h)
        
        # Title
        cv2.putText(frame, "DEMOGRAPHICS", (panel_x + 20, panel_y + 40),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, self.ACCENT_PRIMARY, 3)
        
        # Gender distribution
        gender = metrics.get('gender', {})
        male = gender.get('male', 0)
        female = gender.get('female', 0)
        unknown = gender.get('unknown', 0)
        total_gender = max(male + female + unknown, 1)
        
        y_offset = panel_y + 80
        cv2.putText(frame, "GENDER", (panel_x + 20, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.TEXT_PRIMARY, 1)
        
        y_offset += 30
        gender_data = [
            ("Male", male, (100, 150, 255)),
            ("Female", female, (255, 100, 150)),
            ("Unknown", unknown, (150, 150, 150)),
        ]
        
        for label, count, color in gender_data:
            progress = count / total_gender
            cv2.putText(frame, f"{label}: {count}", (panel_x + 30, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, self.TEXT_SECONDARY, 1)
            self.draw_progress_bar(frame, panel_x + 150, y_offset - 15, 150, 12, progress, color)
            y_offset += 35
        
        # Age distribution
        y_offset += 20
        cv2.putText(frame, "AGE GROUPS", (panel_x + 20, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, self.TEXT_PRIMARY, 1)
        
        y_offset += 30
        age_buckets = metrics.get('ageBuckets', {})
        age_data = [
            ("Çocuk (0-17)", age_buckets.get('child', 0), (255, 200, 100)),
            ("Genç (18-35)", age_buckets.get('young', 0), (100, 255, 200)),
            ("Orta (36-50)", age_buckets.get('middleage', 0), (100, 200, 255)),
            ("Yaşlı (51-70)", age_buckets.get('old', 0), (200, 150, 255)),
            ("İhtiyar (70+)", age_buckets.get('elderly', 0), (255, 100, 150)),
        ]
        
        total_age = max(sum(d[1] for d in age_data), 1)
        
        for label, count, color in age_data:
            progress = count / total_age
            cv2.putText(frame, f"{label}: {count}", (panel_x + 30, y_offset),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.45, self.TEXT_SECONDARY, 1)
            self.draw_progress_bar(frame, panel_x + 150, y_offset - 15, 150, 12, progress, color)
            y_offset += 35
    
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
        self.draw_stats_panel(frame, metrics)
        self.draw_demographics_panel(frame, metrics)
        self.draw_heatmap_overlay(frame, metrics)
        return frame
    
    def handle_key(self, key: int) -> bool:
        """Handle keyboard input for toggling panels"""
        if key == ord('g') or key == ord('G'):
            self.state.toggle_stats()
            return True
        elif key == ord('h') or key == ord('H'):
            self.state.toggle_heatmap()
            return True
        elif key == ord('d') or key == ord('D'):
            self.state.toggle_demographics()
            return True
        elif key == ord('a') or key == ord('A'):
            self.state.toggle_all()
            return True
        return False
