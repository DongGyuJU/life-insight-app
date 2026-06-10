import 'react-native-gesture-handler';
import React, { useEffect } from 'react'; // ← useEffect 추가
import {Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SettingsProvider} from './src/services/SettingsContext';
import HomeScreen from './src/screens/HomeScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { LogBox } from 'react-native';
import { initUser, registerAutoSync } from './src/services/syncService';


const Tab = createBottomTabNavigator();

export default function App() {

  // ↓ 이 블록만 추가
  useEffect(() => {
    initUser();
    const cleanup = registerAutoSync();
    return cleanup;
  }, []);

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SettingsProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={({route}) => ({
                tabBarActiveTintColor: '#BA7517',
                tabBarInactiveTintColor: '#999',
                tabBarStyle: {
                  borderTopWidth: 0.5,
                  borderTopColor: '#e0e0e0',
                  paddingBottom: 8,
                  height: 60,
                },
                headerShown: false,
                tabBarIcon: ({size}) => {
                  const icons: Record<string, string> = {
                    홈: '🏠',
                    분류: '📊',   
                    캘린더: '📅',
                    리포트: '📋',
                    설정: '⚙️',
                  };
                  return (
                    <Text style={{fontSize: size - 4}}>
                      {icons[route.name]}
                    </Text>
                  );
                },
              })}>
              <Tab.Screen name="홈" component={HomeScreen} />
              <Tab.Screen name="분류" component={CategoryScreen} />
              <Tab.Screen name="캘린더" component={CalendarScreen} />
              <Tab.Screen name="리포트" component={ReportScreen} />
              <Tab.Screen name="설정" component={SettingsScreen} />
            </Tab.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

LogBox.ignoreLogs(['InteractionManager has been deprecated']);