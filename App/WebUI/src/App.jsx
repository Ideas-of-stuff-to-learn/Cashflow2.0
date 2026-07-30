/*
While no data is available new account or data loading say a box saying preparing and a loading thing and randomly osicallting bars for fun
Legend colour beside categories in UI. Not changeable just legend and perhaps hover detection tells colour too
Income line labelled
Total needs to be roudned to nearest whole number
Long total numbers need thousands seperators
Make the Spend by year bolder and bigger
Add the badges to the dashbaord one too
Backfill entire concept changing again:
    To be understood by client


*/


import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import RoleBadge from './components/RoleBadge';
import RequireAuth from './components/RequiresAuth';
import RootRedirect from './components/RootRedirect';
import Layout from './components/Layout';

import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import ContentsScreen from './screens/ContentsScreen';
import DashboardScreen from './screens/Dashboard';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import OrientationGuard from './components/OrientationGuard';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename={import.meta.env.PROD ? '/Cashflow2.0' : '/'}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignupScreen />} />

          <Route element={<OrientationGuard><Layout /></OrientationGuard>}>
            <Route path="/dashboard" element={<RequireAuth><DashboardScreen /></RequireAuth>} />
            <Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />
            <Route path="/charts" element={<RequireAuth><ChartsScreen /></RequireAuth>} />
            <Route path="/contents" element={<RequireAuth><ContentsScreen /></RequireAuth>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}