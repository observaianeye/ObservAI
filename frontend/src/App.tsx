import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataModeProvider } from './contexts/DataModeContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalAlerts from './components/GlobalAlerts';
import GlobalChatbot from './components/GlobalChatbot';
import LoadingScreen from './components/LoadingScreen';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const CameraAnalyticsPage = lazy(() => import('./pages/dashboard/CameraAnalyticsPage'));
const ZoneLabelingPage = lazy(() => import('./pages/dashboard/ZoneLabelingPage'));
const CameraSelectionPage = lazy(() => import('./pages/dashboard/CameraSelectionPage'));
const AIInsightsPage = lazy(() => import('./pages/dashboard/AIInsightsPage'));
const HistoricalAnalyticsPage = lazy(() => import('./pages/dashboard/HistoricalAnalyticsPage'));
const NotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));

function App() {
  return (
    <AuthProvider>
      <DataModeProvider>
        <Router>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout><CameraAnalyticsPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/zone-labeling"
            element={
              <ProtectedRoute>
                <DashboardLayout><ZoneLabelingPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/camera-selection"
            element={
              <ProtectedRoute>
                <DashboardLayout><CameraSelectionPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/ai-insights"
            element={
              <ProtectedRoute>
                <DashboardLayout><AIInsightsPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/historical"
            element={
              <ProtectedRoute>
                <DashboardLayout><HistoricalAnalyticsPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <ProtectedRoute>
                <DashboardLayout><NotificationsPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute>
                <DashboardLayout><SettingsPage /></DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>

        <GlobalAlerts />
        <GlobalChatbot />
      </Router>
      </DataModeProvider>
    </AuthProvider>
  );
}

export default App;
