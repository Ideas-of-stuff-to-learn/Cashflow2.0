import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import LoginScreen from './screens/LoginScreen';
import RequireAuth from './components/RequiresAuth';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import ContentsScreen from './screens/ContentsScreen';
import Layout from './components/Layout';
import DashboardScreen from './screens/Dashboard';
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          {/*<Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />*/}
          <Route path="/signup" element={<SignupScreen />} />
          <Route element={<Layout />}>
          {/*<Route path="/charts" element={<RequireAuth><ChartsScreen /></RequireAuth>} />*/}
          <Route path="/contents" element={<RequireAuth><ContentsScreen /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><DashboardScreen /></RequireAuth>} />
        </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}