/*
While no data is available new account or data loading say a box saying preparing and a loading thing and randomly osicallting bars for fun
Legend colour beside categories in UI. Not changeable just legend and perhaps hover detection tells colour too
Income line labelled
Shows totals on top of bars for monthly and yearly
Make a hover function on the bars to show the category name and value [what is being displayed underneath] replacing the totals shown underneath the chart

Backfill entire concept changing again:
    Make monthly as a window for 12 months that can go back and forth across all data
    Month chart is always there doesn't appear as a condition just the window adjusts
*/
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import RequireAuth from './components/RequiresAuth';
import ResponsiveGate from './components/ResponsiveGate';
import Layout from './components/Layout';

import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import ContentsScreen from './screens/ContentsScreen';
import DashboardScreen from './screens/Dashboard';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';

export default function App() {
  return (
    <AppProvider>
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