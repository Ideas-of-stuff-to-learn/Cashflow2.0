/*

Tasks to do:

Pause everything and make current working one into a website
    This is not insignificant
        For client's understand I have written in react native so writing the website in r react means I can reuse some logic, but I will have to rewrite every single file that outputs a visible thing toa different syntax
        I must find a strong equivalent of expo secure store on web
        I must account for CORS and potentially need to add middleware to trick IoS browsers
        
Road map accurate to deployed to play store and app store
Actual process
And costs to maintain like backend free tier, google Gemini Api payment plan, google play store price
Research what is needed to pass the review
Make into windows app wrapped
Deploying to Microsoft store, process and price
Homepage should say processing will take this long [approx.] add timer done the whle what batch am I on you can close the app and come back in a bit
Backfill should only work for adjacent years. If there is a gap there is the previous month with blank bars or no bars
Organise code into more structured format: login screen, signup screen
*/
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './AppContext.js';
import RoleBadge from './components/RoleBadge.js';

import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import ContentsScreen from './screens/ContentsScreen'
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import Layout from './components/Layout';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route element={<Layout />}>
              <Route path="/home" element={<HomeScreen />} />
              <Route path="/charts" element={<ChartsScreen />} />
              <Route path="/contents" element={<ContentsScreen />} />
            </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}