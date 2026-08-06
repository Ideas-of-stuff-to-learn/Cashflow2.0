import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import RequireAuth from './components/RequiresAuth';
import ResponsiveGate from './components/ResponsiveGate';
import Layout from './components/Layout';
import ManualReviewGate from './components/manualReview/ManualReviewGate';

import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import ContentsScreen from './screens/ContentsScreen';
import DashboardScreen from './screens/Dashboard';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';

export default function App() {
  return (
    <AppProvider>
      <ManualReviewGate />
      <BrowserRouter basename={import.meta.env.PROD ? '/Cashflow2.0' : '/'}>
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
      </BrowserRouter>
    </AppProvider>
  );
}