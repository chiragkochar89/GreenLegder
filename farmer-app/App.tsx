import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LangProvider, useLang } from './src/components/LangContext';
import { AuthProvider, useAuth } from './src/components/AuthContext';

import WelcomeScreen  from './src/screens/WelcomeScreen';
import OTPScreen      from './src/screens/OTPScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PendingScreen  from './src/screens/PendingScreen';
import HomeScreen     from './src/screens/HomeScreen';
import SensorsScreen  from './src/screens/SensorsScreen';
import CreditsScreen  from './src/screens/CreditsScreen';
import AlertsScreen   from './src/screens/AlertsScreen';
import ProfileScreen  from './src/screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    home: '🏠', sensors: '📡', credits: '🌿', alerts: '🔔', profile: '👤',
  };
  return <Text style={{ fontSize: 20 }}>{icons[name] || '•'}</Text>;
}

function MainTabs() {
  const { t } = useLang();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a2e1a',
          borderTopColor: '#2d4a2d',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 62,
        },
        tabBarActiveTintColor:   '#4ade80',
        tabBarInactiveTintColor: '#4a5e4a',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tab.Screen name="Home"    component={HomeScreen}
        options={{ tabBarLabel: t('home'),    tabBarIcon: ({ color }) => <TabIcon name="home"    color={color} /> }} />
      <Tab.Screen name="Sensors" component={SensorsScreen}
        options={{ tabBarLabel: t('sensors'), tabBarIcon: ({ color }) => <TabIcon name="sensors" color={color} /> }} />
      <Tab.Screen name="Credits" component={CreditsScreen}
        options={{ tabBarLabel: t('credits'), tabBarIcon: ({ color }) => <TabIcon name="credits" color={color} /> }} />
      <Tab.Screen name="Alerts"  component={AlertsScreen}
        options={{ tabBarLabel: t('alerts'),  tabBarIcon: ({ color }) => <TabIcon name="alerts"  color={color} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen}
        options={{ tabBarLabel: t('profile'), tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} /> }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { farm, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={s.loadingTxt}>GreenLedger</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {farm ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <>
          <Stack.Screen name="Welcome"  component={WelcomeScreen} />
          <Stack.Screen name="OTP"      component={OTPScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Pending"  component={PendingScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LangProvider>
          <AuthProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </LangProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  loading:    { flex: 1, backgroundColor: '#0f1f0f', alignItems: 'center', justifyContent: 'center' },
  loadingTxt: { color: '#4ade80', fontSize: 22, fontWeight: '700', marginTop: 16 },
});
