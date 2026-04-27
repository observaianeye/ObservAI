// Analytics Data Service - Live data only
// Acts as a single subscription distribution layer over cameraBackendService.
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

export interface ZoneData {
  id: string;
  name: string;
  currentOccupants: number;
  totalVisitors: number;
  avgDwellTime: number;
}

export interface DwellTimeMetrics {
  average: number;
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
  zones?: ZoneData[];
  dwellTime: DwellTimeMetrics;
  lastUpdated: Date;
}

type AnalyticsCallback = (data: AnalyticsData) => void;

function emptyAnalytics(): AnalyticsData {
  return {
    gender: { male: 0, female: 0, unknown: 0 },
    age: { '0-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0 },
    visitors: { current: 0, entryCount: 0, exitCount: 0, totalToday: 0 },
    zones: [],
    dwellTime: { average: 0, min: 0, max: 0 },
    lastUpdated: new Date(),
  };
}

class AnalyticsDataService {
  private latestData: AnalyticsData | null = null;
  private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
  private unsubscribeAnalytics: (() => void) | null = null;
  private callbacks: Set<AnalyticsCallback> = new Set();
  private isConnected: boolean = false;

  async getData(): Promise<AnalyticsData> {
    return this.latestData ?? emptyAnalytics();
  }

  startRealtimeUpdates(onUpdate: AnalyticsCallback): () => void {
    this.callbacks.add(onUpdate);

    if (!this.isConnected && this.callbacks.size === 1) {
      this.connectWebSocket();
    }

    if (this.latestData) {
      onUpdate(this.latestData);
    }

    return () => {
      this.callbacks.delete(onUpdate);
      if (this.callbacks.size === 0) {
        this.disconnectWebSocket();
      }
    };
  }

  private connectWebSocket() {
    if (this.isConnected) return;

    cameraBackendService.connect(this.BACKEND_URL);
    this.isConnected = true;

    this.unsubscribeAnalytics = cameraBackendService.onAnalytics((backendData) => {
      const analyticsData = this.transformBackendData(backendData);
      this.latestData = analyticsData;
      this.callbacks.forEach(cb => cb(analyticsData));
    });
  }

  private disconnectWebSocket() {
    if (this.unsubscribeAnalytics) {
      this.unsubscribeAnalytics();
      this.unsubscribeAnalytics = null;
    }
    this.isConnected = false;
  }

  private transformBackendData(backendData: BackendAnalytics): AnalyticsData {
    const ages = backendData.demographics.ages;

    return {
      gender: {
        male: backendData.demographics.gender.male || 0,
        female: backendData.demographics.gender.female || 0,
        unknown: backendData.demographics.gender.unknown || 0,
      },
      age: {
        '0-17': ages['0-17'] || 0,
        '18-24': ages['18-24'] || 0,
        '25-34': ages['25-34'] || 0,
        '35-44': ages['35-44'] || 0,
        '45-54': ages['45-54'] || 0,
        '55-64': ages['55-64'] || 0,
        '65+': ages['65+'] || 0,
      },
      genderByAge: backendData.demographics.genderByAge,
      visitors: {
        current: backendData.current || 0,
        entryCount: backendData.entries || 0,
        exitCount: backendData.exits || 0,
        totalToday: backendData.entries || 0,
      },
      zones: backendData.zones || [],
      dwellTime: {
        average: backendData.avgDwellTime ?? 0,
        min: 0,
        max: 0,
      },
      lastUpdated: new Date(backendData.timestamp || Date.now()),
    };
  }

  stopRealtimeUpdates() {
    this.disconnectWebSocket();
  }
}

export const analyticsDataService = new AnalyticsDataService();
