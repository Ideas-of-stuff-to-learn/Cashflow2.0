import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppStateProvider } from './appState';
import RequireAuth from './components/RequiresAuth';
import ResponsiveGate from './components/ResponsiveGate';
import Layout from './components/Layout';
import ManualReviewGate from './components/manualReview/ManualReviewGate';

import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import DashboardScreen from './screens/Dashboard';

const ChartsScreen = lazy(() => import('./screens/ChartsScreen'));
const ContentsScreen = lazy(() => import('./screens/ContentsScreen'));

function ScreenSpinner() {
  return (
    <div className="login-container">
      <h1 className="login-title">Transaction Categorizer</h1>
      <div className="login-loading-wrap">
        <div className="login-spinner-ring" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <ManualReviewGate />
      <BrowserRouter basename={import.meta.env.PROD ? '/Cashflow2.0' : '/'}>
        <Suspense fallback={<ScreenSpinner />}>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />

            <Route element={<ResponsiveGate />}>
              <Route path="/" element={null} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<RequireAuth><DashboardScreen /></RequireAuth>} />
                <Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />
                <Route path="/charts" element={<RequireAuth><ChartsScreen /></RequireAuth>} />
                <Route path="/contents" element={<RequireAuth><ContentsScreen /></RequireAuth>} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppStateProvider>
  );
}
