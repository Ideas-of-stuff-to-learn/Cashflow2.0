/*

Tasks to do:
  Road map accurate to deployed to play store and app store
    Actual process
    And costs to maintain like backend free tier, google Gemini Api payment plan, google play store price
    Research what is needed to pass the review
  Make into windows app wrapped
  Deploying to Microsoft store
    process and price
  Manually categorise pop resolve feature should say top right the number of manually categorise things left to manually categorise
  Homepage should say processing will take this long [approx.] you can close the app and come back in a bit
  Backfill should only work for adjacent years. If there is a gap there is the previous month with blank bars or no bars
  Organise code into more structured format
  Test higher cache and batch size to speed up potentially

*/
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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