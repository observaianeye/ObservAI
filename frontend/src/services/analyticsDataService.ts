// Analytics Data Service - Provides both Demo and Live data
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
class LiveDataProvider {
  private latestData: AnalyticsData | null = null;
  private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
  private unsubscribeAnalytics: (() => void) | null = null;

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

  connectWebSocket(onUpdate: (data: AnalyticsData) => void) {
    if (this.unsubscribeAnalytics) {
      return; // Already connected
    }

    // Connect to backend Socket.IO
    cameraBackendService.connect(this.BACKEND_URL);

    // Subscribe to analytics updates
    this.unsubscribeAnalytics = cameraBackendService.onAnalytics((backendData) => {
      const analyticsData = this.transformBackendData(backendData);
      this.latestData = analyticsData;
      onUpdate(analyticsData);
    });

    console.log('[LiveDataProvider] Connected to camera backend');
  }

  disconnectWebSocket() {
    if (this.unsubscribeAnalytics) {
      this.unsubscribeAnalytics();
      this.unsubscribeAnalytics = null;
    }
    cameraBackendService.disconnect();
    console.log('[LiveDataProvider] Disconnected from camera backend');
  }
}

// Main Analytics Data Service
class AnalyticsDataService {
  private demoProvider: DemoDataProvider;
  private liveProvider: LiveDataProvider;
  private currentMode: DataMode = 'demo';
  private demoData: AnalyticsData | null = null;
  private updateInterval: number | null = null;

  constructor() {
    this.demoProvider = new DemoDataProvider();
    this.liveProvider = new LiveDataProvider();
  }

  setMode(mode: DataMode) {
    this.currentMode = mode;

    // Clean up when switching modes
    if (mode === 'live') {
      this.stopDemoUpdates();
    } else {
      this.liveProvider.disconnectWebSocket();
    }
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

  startRealtimeUpdates(onUpdate: (data: AnalyticsData) => void) {
    if (this.currentMode === 'demo') {
      this.startDemoUpdates(onUpdate);
    } else {
      this.liveProvider.connectWebSocket(onUpdate);
    }
  }

  private startDemoUpdates(onUpdate: (data: AnalyticsData) => void) {
    if (this.updateInterval) return;

    this.updateInterval = window.setInterval(() => {
      if (this.demoData) {
        this.demoData = this.demoProvider.getUpdatedData(this.demoData);
        onUpdate(this.demoData);
      }
    }, 5000); // Update every 5 seconds in demo mode
  }

  private stopDemoUpdates() {
    if (this.updateInterval) {
      window.clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  stopRealtimeUpdates() {
    this.stopDemoUpdates();
    this.liveProvider.disconnectWebSocket();
  }
}

// Export singleton instance
export const analyticsDataService = new AnalyticsDataService();
