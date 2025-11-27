/**
 * Camera Backend Service
 * Manages connection to the Python backend via Socket.IO
 * Handles real-time analytics data streaming
 */

import { io, Socket } from 'socket.io-client';

export interface Detection {
  id: string;
  bbox: [number, number, number, number]; // [x, y, width, height] in normalized coords
  gender: 'male' | 'female' | 'unknown';
  ageBucket: string | null;
  dwellSec: number;
  state: 'entering' | 'present' | 'exiting';
}

export interface AnalyticsData {
  timestamp: number;
  entries: number;
  exits: number;
  current: number;
  queue: number;
  demographics: {
    gender: {
      male: number;
      female: number;
      unknown: number;
    };
    ages: {
      [key: string]: number;
    };
  };
  heatmap: {
    points: Array<{
      x: number;
      y: number;
      intensity: number;
    }>;
    gridWidth: number;
    gridHeight: number;
  };
  fps: number;
}

export interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'entrance' | 'exit';
  color: string;
}

export interface ZoneInsight {
  zoneId: string;
  zoneName: string;
  personId: string;
  duration: number;
  timestamp: number;
  message: string;
}

type AnalyticsCallback = (data: AnalyticsData) => void;
type DetectionsCallback = (detections: Detection[]) => void;
type ZoneInsightsCallback = (insights: ZoneInsight[]) => void;

class CameraBackendService {
  private socket: Socket | null = null;
  private analyticsCallbacks: Set<AnalyticsCallback> = new Set();
  private detectionsCallbacks: Set<DetectionsCallback> = new Set();
  private zoneInsightsCallbacks: Set<ZoneInsightsCallback> = new Set();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    // Socket.IO will be initialized when connect() is called
  }

  connect(url: string = 'http://localhost:5001'): void {
    if (this.socket?.connected) {
      console.log('[CameraBackend] Already connected');
      return;
    }

    console.log(`[CameraBackend] Connecting to ${url}...`);

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[CameraBackend] Connected to backend');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('[CameraBackend] Disconnected from backend');
      this.isConnected = false;
    });

    this.socket.on('connection', (data: any) => {
      console.log('[CameraBackend] Connection confirmed:', data);
    });

    // Listen for analytics data (global stream)
    this.socket.on('global', (data: AnalyticsData) => {
      this.analyticsCallbacks.forEach(callback => callback(data));
    });

    // Listen for detection tracks
    this.socket.on('tracks', (tracks: Detection[]) => {
      this.detectionsCallbacks.forEach(callback => callback(tracks));
    });

    // Listen for zone insights
    this.socket.on('zone_insights', (insights: ZoneInsight[]) => {
      this.zoneInsightsCallbacks.forEach(callback => callback(insights));
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[CameraBackend] Connection error:', error.message);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[CameraBackend] Max reconnect attempts reached');
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      console.log('[CameraBackend] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  onAnalytics(callback: AnalyticsCallback): () => void {
    this.analyticsCallbacks.add(callback);
    return () => {
      this.analyticsCallbacks.delete(callback);
    };
  }

  onDetections(callback: DetectionsCallback): () => void {
    this.detectionsCallbacks.add(callback);
    return () => {
      this.detectionsCallbacks.delete(callback);
    };
  }

  onZoneInsights(callback: ZoneInsightsCallback): () => void {
    this.zoneInsightsCallbacks.add(callback);
    return () => {
      this.zoneInsightsCallbacks.delete(callback);
    };
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  saveZones(zones: Zone[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      this.socket.emit('save_zones', { zones }, (response: any) => {
        if (response?.status === 'success') {
          resolve();
        } else {
          reject(new Error(response?.message || 'Failed to save zones'));
        }
      });

      this.socket.once('zones_saved', (response: any) => {
        if (response?.status === 'success') {
          resolve();
        } else {
          reject(new Error(response?.message || 'Failed to save zones'));
        }
      });
    });
  }

  getZones(): Promise<Zone[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      this.socket.emit('get_zones');

      this.socket.once('zones_config', (response: any) => {
        resolve(response?.zones || []);
      });

      setTimeout(() => {
        reject(new Error('Timeout waiting for zones'));
      }, 5000);
    });
  }

  startStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      this.socket.emit('start_stream');

      this.socket.once('stream_status', (response: any) => {
        if (response?.status === 'started') {
          resolve();
        } else {
          reject(new Error('Failed to start stream'));
        }
      });
    });
  }

  stopStream(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      this.socket.emit('stop_stream');

      this.socket.once('stream_status', (response: any) => {
        if (response?.status === 'stopped') {
          resolve();
        } else {
          reject(new Error('Failed to stop stream'));
        }
      });
    });
  }

  getSnapshot(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      this.socket.emit('get_snapshot');

      this.socket.once('snapshot_data', (response: any) => {
        if (response?.image) {
          resolve(response.image);
        } else {
          reject(new Error('Invalid snapshot data'));
        }
      });

      this.socket.once('snapshot_error', (response: any) => {
        reject(new Error(response?.message || 'Failed to capture snapshot'));
      });

      setTimeout(() => {
        reject(new Error('Timeout waiting for snapshot'));
      }, 10000);
    });
  }

  changeSource(source: number | string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      console.log('[CameraBackend] Changing source to:', source);
      this.socket.emit('change_source', { source });

      this.socket.once('source_changed', (response: any) => {
        if (response?.status === 'success') {
          console.log('[CameraBackend] Source changed successfully to:', response.source);
          resolve();
        } else {
          reject(new Error(response?.message || 'Failed to change source'));
        }
      });

      setTimeout(() => {
        reject(new Error('Timeout waiting for source change'));
      }, 10000);
    });
  }

  ping(): void {
    if (this.socket) {
      this.socket.emit('ping');
    }
  }
}

// Singleton instance
export const cameraBackendService = new CameraBackendService();
