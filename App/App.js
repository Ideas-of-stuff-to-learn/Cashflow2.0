/*

Tasks to be done next
Wrap app in wrapper for desktop app
More charts
Add pagination to transaction extraction
Fix icon issue DONE
Got to add a select all and deselect all to the current multi select recategorization one DONE
Got to add category rename DONE
Got to add small description drawn from database saying how many files uploaded and what range on the homepage DONE
Optimise backend db calls and backend in general DONE


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