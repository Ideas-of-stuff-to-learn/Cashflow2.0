import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext';
import LoginScreen from './screens/LoginScreen';
//import SignupScreen from './screens/SignupScreen';
// import HomeScreen from './screens/HomeScreen';
// import ChartsScreen from './screens/ChartsScreen';
// import ContentsScreen from './screens/ContentsScreen';
// import Layout from './components/Layout';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          {/*<Route path="/signup" element={<SignupScreen />} />*/}
          {/* <Route element={<Layout />}>
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/charts" element={<ChartsScreen />} />
            <Route path="/contents" element={<ContentsScreen />} />
          </Route> */}
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}