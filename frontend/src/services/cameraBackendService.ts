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
      '0-17': number;
      '18-24': number;
      '25-34': number;
      '35-44': number;
      '45-54': number;
      '55-64': number;
      '65+': number;
      [key: string]: number; // Fallback index signature
    };
    genderByAge: {
      [ageRange: string]: {
        male: number;
        female: number;
        unknown: number;
      };
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
  zones?: Array<{
    id: string;
    name: string;
    currentOccupants: number;
    totalVisitors: number;
    avgDwellTime: number;
  }>;
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

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'failed';

type AnalyticsCallback = (data: AnalyticsData) => void;
type DetectionsCallback = (detections: Detection[]) => void;
type ZoneInsightsCallback = (insights: ZoneInsight[]) => void;
type ConnectionStatusCallback = (status: ConnectionStatus, attempts?: number) => void;

class CameraBackendService {
  private socket: Socket | null = null;
  private analyticsCallbacks: Set<AnalyticsCallback> = new Set();
  private detectionsCallbacks: Set<DetectionsCallback> = new Set();
  private zoneInsightsCallbacks: Set<ZoneInsightsCallback> = new Set();
  private connectionStatusCallbacks: Set<ConnectionStatusCallback> = new Set();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private connectionStatus: ConnectionStatus = 'disconnected';

  // Data caching for fallback
  private lastAnalyticsData: AnalyticsData | null = null;
  private lastDetections: Detection[] = [];
  private lastZoneInsights: ZoneInsight[] = [];

  constructor() {
    // Socket.IO will be initialized when connect() is called
  }

  private updateConnectionStatus(status: ConnectionStatus, attempts?: number): void {
    this.connectionStatus = status;
    this.connectionStatusCallbacks.forEach(callback => callback(status, attempts));
  }

  connect(url: string = 'http://localhost:5001'): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
    });

    this.socket.on('reconnect_attempt', () => {
      this.updateConnectionStatus('reconnecting', this.reconnectAttempts + 1);
    });

    this.socket.on('connection', () => {
      // Connection confirmed - no action needed
    });

    // Listen for analytics data (global stream)
    this.socket.on('global', (data: AnalyticsData) => {
      this.lastAnalyticsData = data; // Cache for fallback
      this.analyticsCallbacks.forEach(callback => callback(data));
    });

    // Listen for detection tracks
    this.socket.on('tracks', (tracks: Detection[]) => {
      this.lastDetections = tracks; // Cache for fallback
      this.detectionsCallbacks.forEach(callback => callback(tracks));
    });

    // Listen for zone insights
    this.socket.on('zone_insights', (insights: ZoneInsight[]) => {
      this.lastZoneInsights = insights; // Cache for fallback
      this.zoneInsightsCallbacks.forEach(callback => callback(insights));
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      this.updateConnectionStatus('reconnecting', this.reconnectAttempts);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.updateConnectionStatus('failed');
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
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

  onConnectionStatus(callback: ConnectionStatusCallback): () => void {
    this.connectionStatusCallbacks.add(callback);
    // Immediately call with current status
    callback(this.connectionStatus, this.reconnectAttempts);
    return () => {
      this.connectionStatusCallbacks.delete(callback);
    };
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getCurrentConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // Get cached data for fallback when disconnected
  getLastAnalyticsData(): AnalyticsData | null {
    return this.lastAnalyticsData;
  }

  getLastDetections(): Detection[] {
    return this.lastDetections;
  }

  getLastZoneInsights(): ZoneInsight[] {
    return this.lastZoneInsights;
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
      }, 30000);
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
      }, 30000);
    });
  }

  changeSource(source: number | string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      console.log('[CameraBackendService] Changing source to:', source);

      // Set up timeout first
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for source change (30s)'));
      }, 30000);

      // Listen for both success and error responses
      const handleSuccess = (response: any) => {
        clearTimeout(timeout);
        this.socket?.off('source_error', handleError);
        if (response?.status === 'success') {
          console.log('[CameraBackendService] Source changed successfully');

          // Check if fallback occurred
          if (response.fallback) {
            console.warn('[CameraBackendService] ⚠️  Fallback occurred:', response.fallback_reason);
            console.warn(`[CameraBackendService] Requested: ${response.requested_source}, Actual: ${response.actual_source}`);

            // Resolve with fallback info so frontend can update UI
            resolve({
              fallback: true,
              requestedSource: response.requested_source,
              actualSource: response.actual_source,
              reason: response.fallback_reason
            } as any);
          } else {
            resolve();
          }
        } else {
          console.error('[CameraBackendService] Source change failed:', response?.message);
          reject(new Error(response?.message || 'Failed to change source'));
        }
      };

      const handleError = (response: any) => {
        clearTimeout(timeout);
        this.socket?.off('source_changed', handleSuccess);
        const errorMsg = response?.message || response?.error || 'Failed to change camera source';
        console.error('[CameraBackendService] Source change error:', errorMsg);
        reject(new Error(errorMsg));
      };

      this.socket.once('source_changed', handleSuccess);
      this.socket.once('source_error', handleError);

      this.socket.emit('change_source', { source });
    });
  }

  toggleHeatmap(visible: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to backend'));
        return;
      }

      this.socket.emit('toggle_heatmap', { visible });

      this.socket.once('heatmap_toggled', (response: { status: string; message?: string }) => {
        if (response?.status === 'success') {
          resolve();
        } else {
          reject(new Error(response?.message || 'Failed to toggle heatmap'));
        }
      });

      setTimeout(() => {
        reject(new Error('Timeout waiting for heatmap toggle'));
      }, 5000);
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
