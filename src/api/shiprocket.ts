import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const SHIPROCKET_BASE_URL = Config.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external';

const shiprocketApi = axios.create({
  baseURL: SHIPROCKET_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get Shiprocket Auth Token. 
 * Checks AsyncStorage for existing token and validity (10 days).
 */
export const getShiprocketToken = async (): Promise<string | null> => {
  try {
    const storedData = await AsyncStorage.getItem('shiprocket_auth');
    if (storedData) {
      const { token, timestamp } = JSON.parse(storedData);
      const now = Date.now();
      const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;
      
      // If token is still valid (e.g., less than 9 days old to be safe)
      if (now - timestamp < tenDaysInMs - (24 * 60 * 60 * 1000)) {
        return token;
      }
    }

    // Otherwise, login to get a new token
    console.log('📡 Fetching new Shiprocket token...');
    const response = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email: Config.SHIPROCKET_EMAIL,
      password: Config.SHIPROCKET_PASSWORD,
    });

    if (response.data && response.data.token) {
      const newToken = response.data.token;
      await AsyncStorage.setItem('shiprocket_auth', JSON.stringify({
        token: newToken,
        timestamp: Date.now(),
      }));
      console.log('✅ Shiprocket token refreshed');
      return newToken;
    }
    console.warn('⚠️ Shiprocket Login response missing token:', response.data);
    return null;
  } catch (error: any) {
    console.error('❌ Shiprocket Auth Error Details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return null;
  }
};


/**
 * Get Shipping Rates (Serviceability)
 */
export const getShippingRates = async (data: {
  delivery_postcode: string;
  weight: number;
  cod: number; // 0 for prepaid, 1 for cod
}) => {
  try {
    const token = await getShiprocketToken();
    if (!token) throw new Error('No Shiprocket token available');

    // 🚀 Dynamic Pickup Selection:
    // We fetch pickup locations to use the Primary warehouse's pincode.
    let pickupPincode = Config.SHIPROCKET_PICKUP_PINCODE || '110001';
    try {
      const tokenForPikup = await getShiprocketToken();
      if (tokenForPikup) {
        const locationsRes = await getPickupLocations();
        if (locationsRes.success && locationsRes.data.length > 0) {
          // Find primary or default to the first one
          const primary = locationsRes.data.find((l: any) => l.is_primary === 1) || locationsRes.data[0];
          if (primary && primary.pin_code) {
            pickupPincode = primary.pin_code.toString();
            console.log(`📍 Using Dynamic Pickup Pincode: ${pickupPincode} (${primary.pickup_location})`);
          }
        }
      }
    } catch (locErr) {
      console.warn('⚠️ Dynamic pickup fetch failed, using fallback pincode:', locErr);
    }

    const params = {
      pickup_postcode: pickupPincode,
      delivery_postcode: data.delivery_postcode,
      weight: data.weight,
      cod: data.cod,
    };



    console.log('📡 Shiprocket Serviceability Request Params:', params);

    const response = await shiprocketApi.get('/courier/serviceability/', {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000, // 15s timeout
    });

    console.log('✅ Shiprocket Serviceability Response:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.status === 200) {

      // Find the cheapest courier or a specific recommendation
      const couriers = response.data.data.available_courier_companies;
      if (couriers && couriers.length > 0) {
        // Sort by rate (freight_charge)
        const sorted = couriers.sort((a: any, b: any) => a.freight_charge - b.freight_charge);
        return {
          success: true,
          rate: sorted[0].freight_charge,
          courier: sorted[0].courier_name,
          estimated_delivery: sorted[0].etd,
        };
      }
    }
    return { success: false, message: 'No service available for this pincode' };
  } catch (error: any) {
    console.error('❌ Shiprocket Serviceability Error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Track Shipment by AWB
 */
export const trackAWB = async (awb: string) => {
  try {
    const token = await getShiprocketToken();
    if (!token) throw new Error('No Shiprocket token available');

    const response = await shiprocketApi.get(`/courier/track/awb/${awb}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.tracking_data) {
      return { success: true, data: response.data.tracking_data };
    }
    return { success: false, message: 'Tracking info not found' };
  } catch (error: any) {
    console.error('❌ Shiprocket Tracking Error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Fetch all Pickup Locations (Warehouses)
 */
export const getPickupLocations = async () => {
  try {
    const token = await getShiprocketToken();
    if (!token) throw new Error('No Shiprocket token available');

    const response = await shiprocketApi.get('/settings/company/pickup', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data && response.data.data) {
      return { 
        success: true, 
        data: response.data.data.shipping_address || [] 
      };
    }
    return { success: false, message: 'No pickup locations found' };
  } catch (error: any) {
    console.error('❌ Shiprocket Pickup Fetch Error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

export default {
  getShiprocketToken,
  getShippingRates,
  trackAWB,
  getPickupLocations,
};

