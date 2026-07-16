/*

Combination of groceries, households and medicines and stationary
Remove transfers
Add others
Fix the upload files counter for non same files
Permission system
Road map accurate to deployed to play store and app store
Make into windows app wrapped
Able to move the stakes around
Show a colour scheme and make aj admin colour changer. No user colour picker 
The extra stuff appears just in my login like category rename and colour picker or an admin concept in backend  concept decide
Dummy files for many years
Scroll horizontal view on month chart
If month chart doesn't have 12 months of data it' backfill remaining months data from previous yr


*/
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './AppContext.js';

import HomeScreen from './screens/HomeScreen';
import ChartsScreen from './screens/ChartsScreen';
import ContentsScreen from './screens/ContentsScreen'
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Charts" component={ChartsScreen} />
          <Stack.Screen name="Contents" component={ContentsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}