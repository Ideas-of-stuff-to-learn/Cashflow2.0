/*

Combination of groceries, households and medicines and stationary DONE
Remove transfers DONE
Add others DONE
Fix the upload files counter for non same files DONE
Permission system
Road map accurate to deployed to play store and app store
Make into windows app wrapped
Able to move the stakes around
Show a colour scheme and make aj admin colour changer. No user colour picker DONE
Dummy files for many years DONE
Scroll horizontal view on month chart DONE
If month chart doesn't have 12 months of data it' backfill remaining months data from previous yr DONE


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