// AppNavigator.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import { LoginScreen } from '../screens/LoginScreen';
import { OTPVerificationScreen } from '../screens/OTPVerificationScreen';
import { BottomTabs } from './BottomTabs';
import { RootStackParamList } from './types';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import CheckoutPage from '../screens/CheckOutScreen';
import { HomeScreen } from '../screens/HomeScreen';

const Stack = createStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  token: string;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({ token }) => {
  return token ? (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabs} />
      <Stack.Screen name="Product" component={ProductDetailScreen} />
      <Stack.Screen name="CheckoutPage" component={CheckoutPage} />
    </Stack.Navigator>
  ) : (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </Stack.Navigator>
  );
};
