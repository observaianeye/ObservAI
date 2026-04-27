import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'));
const NotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
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
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute>
                    <DashboardLayout><AnalyticsPage /></DashboardLayout>
                  </ProtectedRoute>
                }
              />
              {/* Redirects from legacy paths (Trends/AIInsights/Historical merged into Analytics) */}
              <Route path="/dashboard/ai-insights" element={<Navigate to="/dashboard/analytics" replace />} />
              <Route path="/dashboard/historical" element={<Navigate to="/dashboard/analytics" replace />} />
              <Route path="/dashboard/trends" element={<Navigate to="/dashboard/analytics" replace />} />
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
