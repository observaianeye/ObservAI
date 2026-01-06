#!/usr/bin/env python3
"""
Zone Counting Verification Script
Connects to the ObservAI Backend WebSocket and prints real-time zone metrics.
"""

import socketio
import sys
import time
import json

# Configuration
BACKEND_URL = 'http://localhost:5001'
TIMEOUT = 30  # Seconds to wait for data

sio = socketio.Client()
start_time = time.time()
data_received = False

@sio.event
def connect():
    print(f"✅ Connected to Backend at {BACKEND_URL}")
    print("Waiting for analytics data...")

@sio.event
def connect_error(data):
    print(f"❌ Connection Failed: {data}")
    sys.exit(1)

@sio.event
def disconnect():
    print("disconnected from server")

@sio.on('global')
def on_message(data):
    global data_received
    data_received = True
    
    print("\n--- Analytics Data Received ---")
    
    # 1. Total Visitors
    entries = data.get('entries', 0)
    current = data.get('current', 0)
    print(f"👥 GLOBAL: Current: {current} | Entries: {entries}")

    # 2. Zone Breakdown
    zones = data.get('zones', [])
    if not zones:
        print("⚠️  No Zones found in data stream.")
        print("   (Have you drawn any zones in the Zone Labeling dashboard?)")
    else:
        print(f"📍 ZONES ({len(zones)} found):")
        print(f"   {'NAME':<20} | {'CURRENT':<10} | {'TOTAL':<10} | {'DWELL (s)':<10}")
        print("-" * 60)
        for zone in zones:
            name = zone.get('name', 'Unknown')
            curr = zone.get('currentOccupants', 0)
            tot = zone.get('totalVisitors', 0)
            avg = zone.get('avgDwellTime', 0)
            print(f"   {name:<20} | {curr:<10} | {tot:<10} | {avg:<10.1f}")
            
    print("-" * 60)
    # Don't exit immediately so user can see updates
    # sys.exit(0)

def main():
    try:
        sio.connect(BACKEND_URL)
        
        # Keep running
        try:
            while True:
                time.sleep(1)
                if time.time() - start_time > TIMEOUT and not data_received:
                    print(f"❌ Timed out waiting for data ({TIMEOUT}s)")
                    sys.exit(1)
        except KeyboardInterrupt:
            print("\nStopping verification...")
            sio.disconnect()
            sys.exit(0)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
