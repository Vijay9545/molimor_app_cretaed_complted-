// BottomTabs.tsx
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AntDesign, {
  AntDesignIconName,
} from '@react-native-vector-icons/ant-design';

// Screens
import { ProductListingScreen } from '../screens/ProductListingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CartScreen } from '../screens/CartScreen';
import { OrderListScreen } from '../screens/OrderListScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { Text, View } from 'react-native';
import api from '../api';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

export type BottomTabParamList = {
  Catalog: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
  Home: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

// 📌 Catalog Stack (Catalog → Product)
const CatalogStack = createStackNavigator();
const CatalogNavigator = () => (
  <CatalogStack.Navigator screenOptions={{ headerShown: false }}>
    <CatalogStack.Screen
      name="ProductListing"
      component={ProductListingScreen}
    />
  </CatalogStack.Navigator>
);

// 📌 Cart Stack
const CartStack = createStackNavigator();
const CartNavigator = () => (
  <CartStack.Navigator screenOptions={{ headerShown: false }}>
    <CartStack.Screen name="CartMain" component={CartScreen} />
  </CartStack.Navigator>
);

const HomeStack = createStackNavigator();
const HomeNavigator = () => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="HomeMain" component={HomeScreen} />
  </HomeStack.Navigator>
);

// 📌 Orders Stack
const OrdersStack = createStackNavigator();
const OrdersNavigator = () => (
  <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
    <OrdersStack.Screen name="OrdersMain" component={OrderListScreen} />
  </OrdersStack.Navigator>
);

// 📌 Profile Stack
const ProfileStack = createStackNavigator();
const ProfileNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
  </ProfileStack.Navigator>
);

export const BottomTabs: React.FC = () => {
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const count = cartItems.length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ color, size }) => {
          let iconName: AntDesignIconName = 'home';
          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Catalog':
              iconName = 'product'; // "product" is not valid, using appstore
              break;
            case 'Cart':
              iconName = 'shopping-cart';
              break;
            case 'Orders':
              iconName = 'truck';
              break;
            case 'Profile':
              iconName = 'user';
              break;
          }
          if (route.name === 'Cart') {
            return (
              <View>
                <AntDesign name={iconName} size={size} color={color} />
                {count > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: -3,
                      backgroundColor: 'red',
                      borderRadius: 8,
                      minWidth: 16,
                      height: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </View>
            );
          }

          return <AntDesign name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeNavigator} />
      <Tab.Screen name="Catalog" component={CatalogNavigator} />
      <Tab.Screen name="Cart" component={CartNavigator} />
      <Tab.Screen name="Orders" component={OrdersNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
};
