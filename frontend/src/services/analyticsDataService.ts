// Analytics Data Service - Provides both Demo and Live data
// NOTE: This service acts as a data distribution layer
// In live mode, it subscribes to cameraBackendService and distributes to multiple UI components
import { DataMode } from '../contexts/DataModeContext';
import { cameraBackendService, AnalyticsData as BackendAnalytics } from './cameraBackendService';

export interface GenderData {
  male: number;
  female: number;
  unknown: number;
}

export interface AgeDistribution {
  '0-17': number;
  '18-24': number;
  '25-34': number;
  '35-44': number;
  '45-54': number;
  '55-64': number;
  '65+': number;
}

export interface VisitorMetrics {
  current: number;
  entryCount: number;
  exitCount: number;
  totalToday: number;
}

export interface DwellTimeMetrics {
  average: number; // in seconds
  min: number;
  max: number;
}

export interface AnalyticsData {
  gender: GenderData;
  age: AgeDistribution;
  genderByAge?: {
    [ageRange: string]: {
      male: number;
      female: number;
      unknown: number;
    };
  };
  visitors: VisitorMetrics;
  dwellTime: DwellTimeMetrics;
  lastUpdated: Date;
}

type AnalyticsCallback = (data: AnalyticsData) => void;

// Demo Data Generator - Realistic café patterns
class DemoDataProvider {
  private currentVisitors: number = 0;
  private entryCount: number = 0;
  private exitCount: number = 0;

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData() {
    const hour = new Date().getHours();

    // Realistic café traffic based on time of day
    if (hour >= 7 && hour < 9) { // Morning rush
      this.currentVisitors = Math.floor(Math.random() * 10) + 15; // 15-25 people
      this.entryCount = Math.floor(Math.random() * 50) + 80;
    } else if (hour >= 9 && hour < 12) { // Mid-morning
      this.currentVisitors = Math.floor(Math.random() * 8) + 8; // 8-16 people
      this.entryCount = Math.floor(Math.random() * 40) + 120;
    } else if (hour >= 12 && hour < 14) { // Lunch rush
      this.currentVisitors = Math.floor(Math.random() * 12) + 18; // 18-30 people
      this.entryCount = Math.floor(Math.random() * 60) + 200;
    } else if (hour >= 14 && hour < 17) { // Afternoon
      this.currentVisitors = Math.floor(Math.random() * 10) + 12; // 12-22 people
      this.entryCount = Math.floor(Math.random() * 50) + 250;
    } else if (hour >= 17 && hour < 20) { // Evening
      this.currentVisitors = Math.floor(Math.random() * 8) + 10; // 10-18 people
      this.entryCount = Math.floor(Math.random() * 40) + 300;
    } else { // Late evening/night
      this.currentVisitors = Math.floor(Math.random() * 5) + 2; // 2-7 people
      this.entryCount = Math.floor(Math.random() * 30) + 350;
    }

    this.exitCount = this.entryCount - this.currentVisitors;
  }

  getAnalyticsData(): AnalyticsData {
    // Realistic gender distribution (slightly more female in café setting)
    const totalVisitors = this.entryCount;
    const femalePercent = 0.52 + (Math.random() * 0.06 - 0.03); // 49-55%
    const femaleCount = Math.round(totalVisitors * femalePercent);
    const maleCount = totalVisitors - femaleCount;

    // Realistic age distribution for café (younger demographics)
    const ageTotal = totalVisitors;
    return {
      gender: {
        male: maleCount,
        female: femaleCount,
        unknown: 0
      },
      age: {
        '0-17': Math.round(ageTotal * 0.08), // 8% children/teens
        '18-24': Math.round(ageTotal * 0.25), // 25% young adults (students)
        '25-34': Math.round(ageTotal * 0.32), // 32% young professionals
        '35-44': Math.round(ageTotal * 0.18), // 18% middle-aged
        '45-54': Math.round(ageTotal * 0.10), // 10%
        '55-64': Math.round(ageTotal * 0.05), // 5%
        '65+': Math.round(ageTotal * 0.02)  // 2% seniors
      },
      visitors: {
        current: this.currentVisitors,
        entryCount: this.entryCount,
        exitCount: this.exitCount,
        totalToday: this.entryCount
      },
      dwellTime: {
        average: 720 + Math.floor(Math.random() * 600), // 12-22 minutes
        min: 180 + Math.floor(Math.random() * 120), // 3-5 minutes
        max: 2400 + Math.floor(Math.random() * 1200) // 40-60 minutes
      },
      lastUpdated: new Date()
    };
  }

  // Simulate real-time updates
  getUpdatedData(previousData: AnalyticsData): AnalyticsData {
    const data = { ...previousData };

    // Small random changes to simulate live updates
    const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    data.visitors.current = Math.max(0, data.visitors.current + change);

    if (change > 0) {
      data.visitors.entryCount += change;
      data.visitors.totalToday += change;
    } else if (change < 0) {
      data.visitors.exitCount += Math.abs(change);
    }

    data.lastUpdated = new Date();
    return data;
  }
}

// Live Data Provider - Connects to backend via Socket.IO
// Uses a single subscription and distributes to multiple callbacks
class LiveDataProvider {
  private latestData: AnalyticsData | null = null;
  private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
  private unsubscribeAnalytics: (() => void) | null = null;
  private callbacks: Set<AnalyticsCallback> = new Set();
  private isConnected: boolean = false;

  async getAnalyticsData(): Promise<AnalyticsData> {
    if (this.latestData) {
      return this.latestData;
    }

    // Return empty/zero state when no data is available yet
    return {
      gender: { male: 0, female: 0, unknown: 0 },
      age: { '0-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0 },
      visitors: { current: 0, entryCount: 0, exitCount: 0, totalToday: 0 },
      dwellTime: { average: 0, min: 0, max: 0 },
      lastUpdated: new Date()
    };
  }

  private transformBackendData(backendData: BackendAnalytics): AnalyticsData {
    // Map backend data directly to frontend state
    const ages = backendData.demographics.ages;

    return {
      gender: {
        male: backendData.demographics.gender.male || 0,
        female: backendData.demographics.gender.female || 0,
        unknown: backendData.demographics.gender.unknown || 0
      },
      age: {
        '0-17': ages['0-17'] || 0,
        '18-24': ages['18-24'] || 0,
        '25-34': ages['25-34'] || 0,
        '35-44': ages['35-44'] || 0,
        '45-54': ages['45-54'] || 0,
        '55-64': ages['55-64'] || 0,
        '65+': ages['65+'] || 0
      },
      genderByAge: backendData.demographics.genderByAge,
      visitors: {
        current: backendData.current || 0,
        entryCount: backendData.entries || 0,
        exitCount: backendData.exits || 0,
        totalToday: backendData.entries || 0
      },
      dwellTime: {
        average: 0, // Backend doesn't provide individual dwell stats in global stream yet
        min: 0,
        max: 0
      },
      lastUpdated: new Date(backendData.timestamp || Date.now())
    };
  }

  // Add a callback to receive analytics updates
  // Returns unsubscribe function
  subscribe(callback: AnalyticsCallback): () => void {
    this.callbacks.add(callback);
    
    // Ensure we're connected when first subscriber joins
    if (!this.isConnected && this.callbacks.size === 1) {
      this.connectWebSocket();
    }
    
    // If we have cached data, send it immediately to new subscriber
    if (this.latestData) {
      callback(this.latestData);
    }
    
    return () => {
      this.callbacks.delete(callback);
      // Disconnect when no more subscribers
      if (this.callbacks.size === 0) {
        this.disconnectWebSocket();
      }
    };
  }

  private connectWebSocket() {
    if (this.isConnected) {
      return;
    }

    // Connect to backend Socket.IO (connection managed by cameraBackendService singleton)
    cameraBackendService.connect(this.BACKEND_URL);
    this.isConnected = true;

    // Subscribe to analytics updates - single subscription
    this.unsubscribeAnalytics = cameraBackendService.onAnalytics((backendData) => {
      const analyticsData = this.transformBackendData(backendData);
      this.latestData = analyticsData;
      // Distribute to all registered callbacks
      this.callbacks.forEach(cb => cb(analyticsData));
    });
  }

  disconnectWebSocket() {
    if (this.unsubscribeAnalytics) {
      this.unsubscribeAnalytics();
      this.unsubscribeAnalytics = null;
    }
    this.isConnected = false;
    // Don't disconnect the underlying socket - CameraFeed owns that
  }
}

// Main Analytics Data Service
// This is a singleton that manages data flow from backend to UI components
class AnalyticsDataService {
  private demoProvider: DemoDataProvider;
  private liveProvider: LiveDataProvider;
  private currentMode: DataMode = 'demo';
  private demoData: AnalyticsData | null = null;
  private demoCallbacks: Set<AnalyticsCallback> = new Set();
  private demoUpdateInterval: number | null = null;
  private liveUnsubscribers: Map<AnalyticsCallback, () => void> = new Map();

  constructor() {
    this.demoProvider = new DemoDataProvider();
    this.liveProvider = new LiveDataProvider();
  }

  setMode(mode: DataMode) {
    if (this.currentMode === mode) return;
    
    // Clean up previous mode
    if (this.currentMode === 'demo') {
      this.stopDemoUpdates();
    } else {
      // Unsubscribe all live callbacks
      this.liveUnsubscribers.forEach(unsub => unsub());
      this.liveUnsubscribers.clear();
    }
    
    this.currentMode = mode;
  }

  async getData(): Promise<AnalyticsData> {
    if (this.currentMode === 'demo') {
      if (!this.demoData) {
        this.demoData = this.demoProvider.getAnalyticsData();
      }
      return this.demoData;
    } else {
      return await this.liveProvider.getAnalyticsData();
    }
  }

  // Subscribe to realtime updates
  // Returns an unsubscribe function that MUST be called on cleanup
  startRealtimeUpdates(onUpdate: AnalyticsCallback): () => void {
    if (this.currentMode === 'demo') {
      return this.subscribeDemoUpdates(onUpdate);
    } else {
      const unsub = this.liveProvider.subscribe(onUpdate);
      this.liveUnsubscribers.set(onUpdate, unsub);
      return () => {
        unsub();
        this.liveUnsubscribers.delete(onUpdate);
      };
    }
  }

  private subscribeDemoUpdates(callback: AnalyticsCallback): () => void {
    this.demoCallbacks.add(callback);
    
    // Start the demo update interval if not already running
    if (!this.demoUpdateInterval && this.demoCallbacks.size > 0) {
      this.demoUpdateInterval = window.setInterval(() => {
        if (this.demoData) {
          this.demoData = this.demoProvider.getUpdatedData(this.demoData);
          this.demoCallbacks.forEach(cb => cb(this.demoData!));
        }
      }, 5000); // Update every 5 seconds in demo mode
    }
    
    // Send initial data immediately
    if (this.demoData) {
      callback(this.demoData);
    }
    
    return () => {
      this.demoCallbacks.delete(callback);
      if (this.demoCallbacks.size === 0) {
        this.stopDemoUpdates();
      }
    };
  }

  private stopDemoUpdates() {
    if (this.demoUpdateInterval) {
      window.clearInterval(this.demoUpdateInterval);
      this.demoUpdateInterval = null;
    }
  }

  // Legacy method - use startRealtimeUpdates instead which returns unsubscribe
  stopRealtimeUpdates() {
    this.stopDemoUpdates();
    this.liveUnsubscribers.forEach(unsub => unsub());
    this.liveUnsubscribers.clear();
  }
}

// Export singleton instance
export const analyticsDataService = new AnalyticsDataService();
