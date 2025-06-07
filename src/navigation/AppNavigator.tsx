// src/navigation/AppNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';

// Import your screens
import HomeScreen from '../screens/HomeScreen';
import UploadScreen from '../screens/UploadScreen';
import RecordScreen from '../screens/RecordScreen';
import ReportScreen from '../screens/ReportScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Record" component={RecordScreen} />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return user ? <MainTabs /> : <AuthNavigator />;
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NavigationContainer>
  );
}