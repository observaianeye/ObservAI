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

type AnalyticsCallback = (data: AnalyticsData) => void;
type DetectionsCallback = (detections: Detection[]) => void;

class CameraBackendService {
  private socket: Socket | null = null;
  private analyticsCallbacks: Set<AnalyticsCallback> = new Set();
  private detectionsCallbacks: Set<DetectionsCallback> = new Set();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    // Socket.IO will be initialized when connect() is called
  }

  connect(url: string = 'http://localhost:5000'): void {
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

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  ping(): void {
    if (this.socket) {
      this.socket.emit('ping');
    }
  }
}

// Singleton instance
export const cameraBackendService = new CameraBackendService();
