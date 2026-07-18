/*

Combination of groceries, households and medicines and stationary DONE
Remove transfers DONE
Add others DONE
Fix the upload files counter for non same files DONE
Permission system DONE
Road map accurate to deployed to play store and app store
Make into windows app wrapped
Able to move the stakes around
Show a colour scheme and make an admin colour changer. No user colour picker DONE
Dummy files for many years DONE
Scroll horizontal view on month chart DONE
If month chart doesn't have 12 months of data it' backfill remaining months data from previous yr DONE
Solve major JWT never expiry issue DONE

*/
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './AppContext.js';
import RoleBadge from './components/RoleBadge.js';

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
        {/* screenOptions.headerRight applies to every screen in this
            navigator that doesn't override it - Login/Signup already
            set headerShown: false so they're unaffected anyway, and
            Home/Charts/Contents all pick this up automatically. One
            wiring point here instead of adding RoleBadge to each
            screen file individually - a new screen added later gets
            it for free with no extra work. */}
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerRight: () => <RoleBadge /> }}>
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