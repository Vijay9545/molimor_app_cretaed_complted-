import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AntDesign from '@react-native-vector-icons/ant-design';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import SalePopup from '../components/UI/SalePopup';
import api from '../api';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../redux/store';
import { fetchCart } from '../redux/slices/cartSlice';

// Define your navigation types
type RootStackParamList = {
  Home: undefined;
  Product: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const [currentPhone, setCurrentPhone] = useState('');
  const [showSalePopup, setShowSalePopup] = useState(false);
  const [popupData, setPopupData] = useState<{ active: boolean; imageUrl?: string; offers?: string[]; title?: string; description?: string; targetScreen?: string } | null>(null);

  useEffect(() => {
    async function init() {
      // Get phone number
      let userData = await AsyncStorage.getItem('userData');
      const phone = userData ? JSON.parse(userData).phone : '';
      setCurrentPhone(phone);

      // Check if Sale Popup should be shown
      const lastShown = await AsyncStorage.getItem('lastSalePopupShown');
      const today = new Date().toDateString();

      try {
        // Fetch promotion/popup data from backend
        const response = await api.get('/promotions/getPromotionPopup'); 
        const data = response.data;
        setPopupData(data);

        console.log('✅ GET PROMOTIONS POPUP API RESPONSE:', JSON.stringify(data, null, 2));
        
        // Show popup if active and we have an image
        // (Bypassing lastShown !== today for testing)
        if (data && data.active && data.imageUrl) {
          setTimeout(() => {
            setShowSalePopup(true);
          }, 1500);
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.warn('⚠️ /promotions/getPromotionPopup endpoint not found.');
        } else {
          console.error('❌ Error fetching popup data:', error.message);
        }
      }
      
      dispatch(fetchCart(false));
    }
    init();
  }, [dispatch]);

  const handleClosePopup = async () => {
    setShowSalePopup(false);
    const today = new Date().toDateString();
    await AsyncStorage.setItem('lastSalePopupShown', today);
  };

  const handleRoleSelect = async (role: string) => {
    try {
      await AsyncStorage.setItem(
        'userData',
        JSON.stringify({ role, phone: currentPhone }),
      );

      //@ts-ignore
      navigation.navigate('Catalog', { screen: 'ProductListing' });
    } catch (error) {
      console.error('Error saving role:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Profile Icon */}
        <View style={styles.profile}>
          <AntDesign name="user" size={40} color="#3b82f6" />
        </View>

        {/* Logo */}
        <Image 
          source={require('../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />

        {/* Welcome Text */}
        <Text style={styles.title}>Welcome to Molimor</Text>

        <Text style={styles.helperText}>
          Please select your role to continue
        </Text>

        {/* Role Buttons */}
        <TouchableOpacity
          style={[styles.roleButton, { borderLeftColor: '#3b82f6' }]}
          onPress={() => handleRoleSelect('distributor')}
        >
          <MaterialIcons name="business" size={24} color="#3b82f6" />
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleTitle}>Distributor</Text>
            <Text style={styles.roleDesc}>
              Access bulk pricing and wholesale rates for business growth
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, { borderLeftColor: '#22c55e' }]}
          onPress={() => handleRoleSelect('retailer')}
        >
          <MaterialIcons name="store" size={24} color="#22c55e" />
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleTitle}>Retailer</Text>
            <Text style={styles.roleDesc}>
              Get trade pricing and business features for your shop
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, { borderLeftColor: '#f97316' }]}
          onPress={() => handleRoleSelect('customer')}
        >
          <MaterialIcons name="person" size={24} color="#f97316" />
          <View style={styles.roleTextWrapper}>
            <Text style={styles.roleTitle}>Customer</Text>
            <Text style={styles.roleDesc}>
              Enjoy retail pricing and consumer shopping experience
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <SalePopup
        isVisible={showSalePopup}
        onClose={handleClosePopup}
        imageUrl={popupData?.imageUrl || undefined}
        offers={popupData?.offers}
        title={popupData?.title}
        description={popupData?.description}
        onPressAction={() => {
          handleClosePopup();
          if (popupData?.targetScreen) {
            // Use the dynamic target screen from backend
            //@ts-ignore
            navigation.navigate('Catalog', { screen: popupData.targetScreen });
          } else {
            // Fallback to default
            //@ts-ignore
            navigation.navigate('Catalog', { screen: 'ProductListing' });
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  profile: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3b82f6',
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 20,
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  helperText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 16,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTextWrapper: {
    marginLeft: 12,
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  roleDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
});
