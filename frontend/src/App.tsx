import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardFilterProvider } from './contexts/DashboardFilterContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalChatbot from './components/GlobalChatbot';
import LoadingScreen from './components/LoadingScreen';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const CameraAnalyticsPage = lazy(() => import('./pages/dashboard/CameraAnalyticsPage'));
const ZoneLabelingPage = lazy(() => import('./pages/dashboard/ZoneLabelingPage'));
const CameraSelectionPage = lazy(() => import('./pages/dashboard/CameraSelectionPage'));
const AIInsightsPage = lazy(() => import('./pages/dashboard/AIInsightsPage'));
const HistoricalAnalyticsPage = lazy(() => import('./pages/dashboard/HistoricalAnalyticsPage'));
const NotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const TrendsPage = lazy(() => import('./pages/dashboard/TrendsPage'));
const StaffingPage = lazy(() => import('./pages/dashboard/StaffingPage'));

function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
        <DashboardFilterProvider>
        <ToastProvider>
          <Router>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

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
              <Route
                path="/dashboard/trends"
                element={
                  <ProtectedRoute>
                    <DashboardLayout><TrendsPage /></DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/staffing"
                element={
                  <ProtectedRoute>
                    <DashboardLayout><StaffingPage /></DashboardLayout>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          <GlobalChatbot />
          </Router>
        </ToastProvider>
        </DashboardFilterProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
