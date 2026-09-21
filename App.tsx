import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { AuthContext } from './src/context/AuthContext';
import api from './src/api';
import { Provider } from 'react-redux';
import { store } from './src/redux/store';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  async function checkAuth() {
    const startTime = Date.now();
    try {
      const currentToken = await AsyncStorage.getItem('authToken');
      setToken(currentToken);
    } catch (error) {
      console.log('Error checking token:', error);
      setToken(null);
    } finally {
      const elapsedTime = Date.now() - startTime;
      const minimumDelay = 2500; // 2.5 seconds for a premium feel
      const delay = Math.max(0, minimumDelay - elapsedTime);
 
      setTimeout(() => {
        setShowSplash(false);
        setLoading(false);
      }, delay);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <Provider store={store}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <AuthContext.Provider
          value={{ token, setToken }}
        >
          <NavigationContainer
            onStateChange={() => {
              // Optional: keep verifying token on navigation change
              checkAuth();
            }}
          >
            <AppNavigator token={token || ''} />
          </NavigationContainer>
        </AuthContext.Provider>
      </SafeAreaView>
    </Provider>
  );
};

export default App;
