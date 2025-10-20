#!/usr/bin/env python3
"""
Realistic VELOCITY_THRESHOLD testing based on actual vehicle movement patterns
"""

import cv2
import numpy as np
import os

def test_realistic_velocity_thresholds(video_path):
    """
    Test VELOCITY_THRESHOLD values based on realistic vehicle movement patterns
    """
    print(f"🚗 Realistic VELOCITY_THRESHOLD Testing")
    print(f"🎬 Video: {video_path}")
    
    if not os.path.exists(video_path):
        print(f"❌ Video not found: {video_path}")
        return
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Could not open video")
        return
    
    # Get video info
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"📊 Video: {width}x{height} @ {fps:.1f} FPS")
    
    # Test different threshold values
    test_values = [0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0]
    
    print(f"\n🔍 Testing realistic vehicle movement patterns...")
    print(f"   (Based on typical vehicle speeds: 0-50 km/h)")
    
    for threshold in test_values:
        print(f"\n📏 VELOCITY_THRESHOLD = {threshold}")
        
        # Simulate different vehicle scenarios
        scenarios = [
            ("Stationary vehicle", 0.0),      # Completely stopped
            ("Very slow (1 km/h)", 0.1),     # Barely moving
            ("Slow (5 km/h)", 0.5),           # Slow city traffic
            ("Normal (20 km/h)", 2.0),       # Normal city speed
            ("Fast (40 km/h)", 4.0),         # Fast city speed
            ("Highway (60 km/h)", 6.0),     # Highway speed
        ]
        
        stationary_count = 0
        moving_count = 0
        
        for scenario_name, speed in scenarios:
            if speed < threshold:
                stationary_count += 1
                status = "STATIONARY"
            else:
                moving_count += 1
                status = "MOVING"
            
            print(f"   {scenario_name:20} ({speed:4.1f} px/frame) → {status}")
        
        # Calculate percentages
        total = stationary_count + moving_count
        stationary_pct = (stationary_count / total) * 100
        
        print(f"   📊 Result: {stationary_count}/{total} stationary ({stationary_pct:.0f}%)")
        
        # Provide interpretation
        if stationary_pct == 100:
            print(f"   ⚠️  Too sensitive - everything is stationary")
        elif stationary_pct >= 80:
            print(f"   ⚠️  Very sensitive - most vehicles stationary")
        elif stationary_pct >= 50:
            print(f"   ✅ Balanced - good mix of stationary/moving")
        elif stationary_pct >= 20:
            print(f"   ⚠️  Less sensitive - fewer stationary detections")
        else:
            print(f"   ❌ Too conservative - very few stationary vehicles")
    
    cap.release()
    
    print(f"\n💡 Realistic Recommendations for your video:")
    print(f"   🎯 Try VELOCITY_THRESHOLD = 1.0-2.0 for balanced detection")
    print(f"   🎯 Use 0.5-1.0 if you want to catch more slow vehicles")
    print(f"   🎯 Use 2.0-3.0 if you want only clearly stationary vehicles")
    print(f"   🎯 Use 5.0+ if you want only completely stopped vehicles")
    
    print(f"\n🔧 Quick Test Values to Try:")
    print(f"   - VELOCITY_THRESHOLD = 1.0  (recommended starting point)")
    print(f"   - VELOCITY_THRESHOLD = 1.5  (if 1.0 is too sensitive)")
    print(f"   - VELOCITY_THRESHOLD = 0.8  (if 1.0 is too conservative)")

def main():
    video_path = "../../asset/videoplayback.mp4"  # Relative path from backend/utils/velocity_testing/
    test_realistic_velocity_thresholds(video_path)

if __name__ == "__main__":
    main()
