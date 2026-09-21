import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { CartItem } from './CartScreen';
// @ts-ignore
import RazorpayCheckout from 'react-native-razorpay';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import api from '../api';
import AntDesign from '@react-native-vector-icons/ant-design';
import Lucide from '@react-native-vector-icons/lucide';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { RootStackParamList } from '../navigation/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { states, stateCityData } from '../utils/locationData';
// Removed direct Shiprocket import



interface PricingTier {
  qty: number;
  price: number;
}

type CheckoutPageNavigationProp = StackNavigationProp<
  RootStackParamList,
  'CheckoutPage'
>;

const SearchableDropdown = ({ 
  visible, 
  onClose, 
  onSelect, 
  data, 
  title 
}: { 
  visible: boolean; 
  onClose: () => void; 
  onSelect: (item: string) => void; 
  data: string[]; 
  title: string;
}) => {
  const [search, setSearch] = useState('');
  const filteredData = data.filter(item => 
    item.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <AntDesign name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBarContainer}>
            <AntDesign name="search" size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredData}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.dropdownItem} 
                onPress={() => {
                  onSelect(item);
                  setSearch('');
                  onClose();
                }}
              >
                <Text style={styles.dropdownItemText}>{item}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 400 }}
          />
        </View>
      </View>
    </Modal>
  );
};

const CheckoutPage = () => {
  const [gstNumber, setGstNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [saveInfo, setSaveInfo] = useState(true);
  const [pricingData, setPricingData] = useState<{ [key: string]: PricingTier[] }>({});
  const [cartItems, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(false);
  const [pincode, setPincode] = useState('');
  const [autoCity, setAutoCity] = useState('');
  const [autoState, setAutoState] = useState('');
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [isServiceable, setIsServiceable] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [contactPerson, setContactPerson] = useState('');
  const [distributorCompany, setDistributorCompany] = useState('');
  const [number, setNumber] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<string>('RAZORPAY');

  const [points, setPoints] = useState(0);
  const [redeem, setRedeem] = useState(0);
  const [role, setRole] = useState<'customer' | 'retailer' | 'distributor'>(
    'customer',
  );
  const [errors, setErrors] = useState({
    contactPerson: '',
    companyName: '',
    deliveryAddress: '',
    businessAddress: '',
    gstNumber: '',
    pincode: '',
  });
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [estimatedDays, setEstimatedDays] = useState<string | null>(null);

  
  // Refresh shipping rate when pincode changes
  React.useEffect(() => {
    if (pincode && pincode.length === 6 && isServiceable) {
      fetchShippingRate(pincode);
    }
  }, [pincode, isServiceable]);


  const navigation = useNavigation<CheckoutPageNavigationProp>();



  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const successScale = useState(new Animated.Value(0))[0];

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const alertScale = useState(new Animated.Value(0))[0];

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertConfig({ visible: true, title, message, type });
    alertScale.setValue(0);
    Animated.spring(alertScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const hideAlert = () => {
    Animated.timing(alertScale, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setAlertConfig(prev => ({ ...prev, visible: false }));
    });
  };

  const animateSuccess = () => {
    successScale.setValue(0);
    Animated.spring(successScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  useFocusEffect(
    useCallback(() => {
      async function getRole() {
        try {
          let userData = await AsyncStorage.getItem('userData');
          const currentRole = userData ? JSON.parse(userData).role : 'customer';
          setRole(currentRole);
          setNumber(userData ? JSON.parse(userData).phone : '');
          const res = await api.get(`/user/getUser`);
          const profileData = res.data.data;
          
          if (profileData) {
            setDeliveryAddress(profileData.deliveryAddress || '');
            setBusinessAddress(profileData.businessAddress || '');
            setContactPerson(profileData.name || '');
            setDistributorCompany(profileData.company || '');
            setGstNumber(profileData.gstNumber || '');
            setPincode(profileData.pincode || '');
            setAutoCity(profileData.city || '');
            setAutoState(profileData.state || '');

            console.log('✅ Auto-filled from profile:', {
              name: profileData.name,
              pincode: profileData.pincode,
              city: profileData.city,
              state: profileData.state
            });

            if (profileData.pincode) {
              // Pass a flag to NOT clear existing values on failure if they came from profile
              checkPincode(profileData.pincode, true);
            }
          }
          
          // Fetch pricing - pass currentRole directly since state update is async
          fetchPricingForCart(currentRole);
        } catch (err) {
          console.error('Error in getRole:', err);
        }
      }
      fetchCart();
      getRole();
    }, []),
  );

  const fetchPricingForCart = async (overrideRole?: string) => {
    try {
      const useRole = overrideRole || role;
      const res = await api.get('/cart/getCart?type=' + useRole);
      const cartData = res.data.data.cartItems || [];
      const productIds = Array.from(new Set<string>(cartData.map((item: any) => item.productId._id)));
      
      if (productIds.length > 0) {
        const pricingPromises = productIds.map(id => api.get(`/product/getProductPricing/${id}`).catch(() => null));
        const results = await Promise.all(pricingPromises);
        const newPricing: { [key: string]: PricingTier[] } = {};
        
        results.forEach((res, index) => {
          if (res && res.data && res.data.success) {
            console.log(`Pricing for checkout ${productIds[index]}:`, res.data);
            newPricing[productIds[index]] = res.data.data;
          }
        });
        setPricingData(newPricing);
      }
    } catch (err) {
      console.log('Error fetching pricing in checkout:', err);
    }
  };

  const getItemPrice = (item: CartItem) => {
    const tiers = pricingData[item.productId._id];
    if (tiers && tiers.length > 0) {
      // Sort tiers by qty descending to find the highest threshold reached
      const sortedTiers = [...tiers].sort((a, b) => b.qty - a.qty);
      const matchedTier = sortedTiers.find(t => item.qty >= t.qty);
      if (matchedTier) return matchedTier.price;
    }
    const variant = item.customer || item.distributor || item.retailer;
    return variant?.price || 0;
  };

  async function fetchCart() {
    let userData = await AsyncStorage.getItem('userData');
    const currentRole = userData ? JSON.parse(userData).role : 'customer';

    setLoading(true);

    try {
      const res = await api.get(
        `/cart/getCart?type=${currentRole ? currentRole : role}`,
      );
      setPoints(res.data.data.totalRewardPoint);
      const cartData = res.data.data.cartItems || [];
      setCart(cartData);
    } catch (err) {
      console.log(err);
      showAlert('Error', 'Failed to fetch cart', 'error');
    } finally {
      setLoading(false);
    }
  }

  const checkPincode = async (code: string, isInitialFetch = false) => {
    if (code.length < 6) {
      setIsServiceable(false);
      return;
    }
    
    try {
      setPincodeLoading(true);
      const res = await api.post('/pincode/checkServiceability', { pincode: code });
      if (res.data.success) {
        // Even if success is true, check for 'not serviceable' message
        const isNotServiceable = res.data.data?.Message?.toLowerCase().includes('not serviceable');
        
        const resData = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
        
        if (resData) {
          const fetchedCity = resData.city || resData.District || resData.district || resData.Block || resData.Division;
          const fetchedState = resData.state || resData.State || resData.Circle;
          
          if (fetchedCity) setAutoCity(fetchedCity);
          if (fetchedState) setAutoState(fetchedState);

          if (isNotServiceable) {
            setIsServiceable(false);
            setErrors(prev => ({ ...prev, pincode: res.data.data.Message || 'Pincode not serviceable' }));
            setShippingFee(0);
          } else {
            setIsServiceable(true);
            setErrors(prev => ({ ...prev, pincode: '' }));
            // Fetch Shiprocket Shipping Rates
            fetchShippingRate(code);
          }
        }

      } else {
        setIsServiceable(false);
        // Don't clear if it's the initial fetch from profile - trust the profile data
        if (!isInitialFetch) {
          setAutoCity('');
          setAutoState('');
        }
        setErrors(prev => ({ ...prev, pincode: res.data.message || 'Pincode not serviceable' }));
      }
    } catch (err: any) {
      console.log('Pincode check error:', err);
      setIsServiceable(false);
      if (!isInitialFetch) {
        setAutoCity('');
        setAutoState('');
      }
      setErrors(prev => ({ ...prev, pincode: 'Error checking pincode' }));
    } finally {
      setPincodeLoading(false);
    }
  };

  const calcTotalWeight = () => {
    // Default weight: 0.5kg per item if not specified
    return cartItems.reduce((sum, item) => sum + (0.5 * item.qty), 0);
  };

  const fetchShippingRate = async (deliveryPincode: string, isCod = false) => {
    try {
      setShippingLoading(true);
      const weight = calcTotalWeight();
      
      const response = await api.get('/order/getShippingRate', {
        params: {
          pincode: deliveryPincode,
          weight: weight,
          cod: isCod ? 1 : 0
        }
      });

      console.log('📦 Fetched Shipping Rate from Backend:', response.data);
      
      if (response.data.success) {
        const res = response.data.data;
        setShippingFee(res.rate || 0);

        if (res.estimated_delivery) {
          try {
            const dateOnly = res.estimated_delivery.split(' ')[0];
            const etd = new Date(dateOnly);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            etd.setHours(0, 0, 0, 0);

            const diffTime = etd.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
              const minDays = diffDays > 1 ? diffDays - 1 : diffDays;
              const maxDays = diffDays + 1;
              const dateStr = etd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
              setEstimatedDays(`${minDays}-${maxDays} Days (by ${dateStr})`);
            } else {
              setEstimatedDays('1-2 Business Days');
            }
          } catch (e) {
            console.warn('❌ Date parsing error:', e);
            setEstimatedDays(null);
          }
        }
      } else {
        setShippingFee(0);
        setEstimatedDays(null);
        console.warn('⚠️ Backend rate fetch failed:', response.data.message);
      }
    } catch (err: any) {
      console.error('Error fetching shipping rate via backend:', err.response?.data || err.message);
      setShippingFee(0);
    } finally {
      setShippingLoading(false);
    }
  };

  const calcSubtotal = () => {

    return cartItems.reduce((sum, item) => {
      const price = getItemPrice(item);
      return sum + price * item.qty;
    }, 0);
  };

  const calcTax = (currentSubtotal: number) => {
    return cartItems.reduce((totalTax, item) => {
      let taxRate = 18; // Default tax rate (18% standard GST)
      const gstString = item.productId?.gst || "";
      const match = gstString.match(/\d+/);
      if (match) taxRate = parseFloat(match[0]);

      const price = getItemPrice(item);
      const qty = Number(item.qty || 0);
      const itemTax = (price * qty * taxRate) / 100;
      return totalTax + itemTax;
    }, 0);
  };


  const calcTotalMRP = () => {
    return cartItems.reduce((sum, item) => {
      const variant = item.customer || item.distributor || item.retailer || item.productId.variants[role];
      return sum + (variant?.mrp || 0) * item.qty;
    }, 0);
  };

  const totalMRP = calcTotalMRP();
  const subtotal = calcSubtotal();
  const tax = calcTax(subtotal);
  const totalDiscount = totalMRP - subtotal;
  const total = redeem 
    ? subtotal + tax + shippingFee - Number(redeem) 
    : subtotal + tax + shippingFee;
  const totalSavings = totalMRP - total + shippingFee;


  const validateFields = () => {
    let newErrors = {
      contactPerson: '',
      companyName: '',
      deliveryAddress: '',
      businessAddress: '',
      gstNumber: '',
      pincode: '',
    };
    let isValid = true;

    if (!contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
      isValid = false;
    }
    if (!distributorCompany.trim()) {
      newErrors.companyName = `${(role || 'Customer').charAt(0).toUpperCase() + (role || 'Customer').slice(1)} name is required`;
      isValid = false;
    }
    if (!deliveryAddress.trim()) {
      newErrors.deliveryAddress = 'Delivery address is required';
      isValid = false;
    }
    if (deliveryAddress.length > 250) {
      newErrors.deliveryAddress = 'Delivery address must be less than 250 characters';
      isValid = false;
    }
    if (businessAddress.length > 250) {
      newErrors.businessAddress = 'Business address must be less than 250 characters';
      isValid = false;
    }

    const gstPattern =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (gstNumber && !gstPattern.test(gstNumber)) {
      newErrors.gstNumber = 'Enter valid GST number';
      isValid = false;
    }

    if (!pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
      isValid = false;
    } else if (pincode.length !== 6) {
      newErrors.pincode = 'Invalid pincode';
      isValid = false;
    } else if (!isServiceable) {
      newErrors.pincode = 'Pincode not serviceable';
      isValid = false;
    }

    setErrors(newErrors as any);
    return isValid;
  };

  const handleRazorpayPayment = (amount: number, orderData: any) => {
    const razorpayKey = Config.RAZORPAY_KEY_ID || 'rzp_test_YourKeyHere';
    console.log(`🔑 Using Razorpay Key: ${razorpayKey.substring(0, 10)}...`);

    const options = {
      description: 'Order Payment',
      currency: 'INR',
      key: razorpayKey,
      amount: Math.round(amount * 100),
      name: 'Channel Flow',
      prefill: {
        email: 'user@example.com',
        contact: number,
        name: contactPerson
      },
      theme: { color: '#007AFF' }
    };

    console.log('🚀 Opening Razorpay with options:', JSON.stringify({ ...options, key: `${options.key.substring(0, 8)}...` }, null, 2));

    RazorpayCheckout.open(options)
      .then(async (data: any) => {
        // Payment Success
        console.log(`Payment Success: ${data.razorpay_payment_id}`);
        // Proceed to place order on backend
        await placeOrderOnBackend(orderData, data.razorpay_payment_id);
      })
      .catch((error: any) => {
        // Payment Failure - Simplified message as per user request
        console.log(`Payment Error: ${error.code} | ${error.description}`);
        showAlert('Payment Failed', 'The transaction was not completed. Please try again.', 'error');
      });
  };

  const placeOrderOnBackend = async (orderData: any, paymentId?: string) => {
    try {
      setInitialLoading(true);
      
      const payload = {
        ...orderData,
        paymentId: paymentId || 'RAZORPAY_PENDING',
        paymentStatus: paymentId ? 'PAID' : 'PENDING'
      };

      const result = await api.post('/order/placeOrder', payload);
      if (result.data.success) {
        // Construct detailed item summary
        const itemSummary = cartItems
          .map(item => `• ${item.productId.title} (x${item.qty})`)
          .join('\n');
          
        const paymentTypeStr = 'Paid via Razorpay';
        const successMessage = `Order placed successfully!\n\nItems:\n${itemSummary}\n\nTotal: ₹${total.toFixed(2)}\nPayment: ${paymentTypeStr}`;

        setShowSuccessModal(true);
        animateSuccess();
        setTimeout(() => {
          setShowSuccessModal(false);
          navigation.navigate('MainTabs');
        }, 3000);
      } else {
        showAlert('Order Failed', result.data.message || 'Failed to place order.', 'error');
      }
    } catch (error: any) {
      console.log('Order error:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error.response) {
        errorMessage = error.response.data?.message || error.response.data?.error || JSON.stringify(error.response.data) || error.message;
      } else if (error.request) {
        errorMessage = 'Network Error: No response from server. Check your internet connection.';
      } else {
        errorMessage = error.message;
      }
      
      showAlert('Order Placement Error', 'Something went wrong while placing your order. Please try again or contact support.', 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateFields()) return;
    
    let orders = cartItems.map(item => {
      const price = getItemPrice(item);
      const type = item.customer ? 'customer' : item.distributor ? 'distributor' : 'retailer';
      return {
        productId: item.productId._id,
        qty: item.qty,
        price: price,
        type: type,
      };
    });

    const orderData = {
      name: contactPerson,
      company: distributorCompany,
      mobile: number,
      gst: gstNumber,
      deliveryAddress: deliveryAddress,
      estimatedDelivery: estimatedDays || "",
      businessAddress: businessAddress,
      pincode: pincode,
      city: autoCity,
      state: autoState,
      usePoint: Number(redeem),
      order: orders,
      paymentMethod: selectedPayment,
      shippingFee: shippingFee,   // Track delivery charges in order
      tax: tax,                   // Track GST breakdown
      subtotal: subtotal,         // Base price
      totalAmount: total          // Final paid amount
    };


    if (selectedPayment === 'RAZORPAY') {
      handleRazorpayPayment(total, orderData);
    }

  };

  const getMaxRedeemablePoints = () => {
    return Math.min(points, subtotal);
  };

  const handleRedeemInputChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    const parsedValue = parseInt(numericValue) || 0;
    const maxRedeemable = getMaxRedeemablePoints();

    if (parsedValue <= maxRedeemable) {
      setRedeem(parsedValue);
    }
  };

  const handleDecrementPoints = () => {
    const currentRedeem = redeem || 0;
    const newValue = Math.max(0, currentRedeem - 10);
    setRedeem(newValue);
  };

  const handleIncrementPoints = () => {
    const currentRedeem = redeem || 0;
    const maxRedeemable = getMaxRedeemablePoints();
    const newValue = Math.min(maxRedeemable, currentRedeem + 10);
    setRedeem(newValue);
  };

  const handleMaxPoints = () => {
    const maxRedeemable = getMaxRedeemablePoints();
    setRedeem(maxRedeemable);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Checkout</Text>
        {points > 0 && (
          <View style={styles.coinMain}>
            <View style={styles.coinIcon}>
              <Lucide name="badge-indian-rupee" size={14} color="#ffffffff" />
            </View>
            <Text style={styles.pointText}>{points}</Text>
          </View>
        )}
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Dynamic Role Badge */}
        <View style={styles.distributorBadge}>
          <Text style={styles.distributorText}>{role.toUpperCase()}</Text>
        </View>

        {/* Order Summary / Price Details */}
        <View style={styles.orderSummary}>
          <Text style={styles.sectionTitle}>Price Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Price ({cartItems.length} items)</Text>
            <Text style={styles.summaryValue}>₹{totalMRP.toFixed(2)}</Text>
          </View>
          {totalDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, { color: '#388e3c' }]}>− ₹{totalDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fees</Text>
            {shippingLoading ? (
               <ActivityIndicator size="small" color="#388e3c" />
            ) : (
              <Text style={[styles.summaryValue, { color: shippingFee > 0 ? '#333' : '#388e3c' }]}>
                {shippingFee > 0 ? `₹${shippingFee.toFixed(2)}` : 'FREE'}
              </Text>
            )}
          </View>


          {tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST / Tax</Text>
              <Text style={styles.summaryValue}>₹{tax.toFixed(2)}</Text>
            </View>
          )}
          {redeem > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Rewards Redeemed</Text>
              <Text style={[styles.summaryValue, { color: '#388e3c' }]}>− ₹{Number(redeem).toFixed(2)}</Text>
            </View>
          )}

          {/* Reward Points Interaction */}
          {points > 0 && (
            <View style={styles.redeemRow}>
              <View style={styles.redeemInfo}>
                <View style={styles.coinIconSmall}>
                  <Lucide name="badge-indian-rupee" size={12} color="#fff" />
                </View>
                <Text style={styles.redeemText}>Use {points} points</Text>
              </View>
              <View style={styles.redeemContainer}>
                <TouchableOpacity
                  style={styles.redeemButton}
                  onPress={handleDecrementPoints}
                  disabled={redeem <= 0}
                >
                  <AntDesign
                    name="minus"
                    size={16}
                    color={redeem <= 0 ? '#ccc' : '#007AFF'}
                  />
                </TouchableOpacity>

                <View style={styles.redeemInputContainer}>
                  <TextInput
                    style={styles.redeemInput}
                    value={redeem.toString()}
                    onChangeText={handleRedeemInputChange}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#999"
                    maxLength={getMaxRedeemablePoints().toString().length}
                  />
                  <Text style={styles.maxPointsText}>
                    /{getMaxRedeemablePoints()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.redeemButton}
                  onPress={handleIncrementPoints}
                  disabled={redeem >= getMaxRedeemablePoints()}
                >
                  <AntDesign
                    name="plus"
                    size={16}
                    color={
                      redeem >= getMaxRedeemablePoints()
                        ? '#ccc'
                        : '#007AFF'
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.maxButton}
                  onPress={handleMaxPoints}
                >
                  <Text style={styles.maxButtonText}>MAX</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
          </View>

          {totalSavings > 0 && (
            <View style={styles.savingsBanner}>
              <AntDesign name="check-circle" size={16} color="#388e3c" style={{ marginRight: 8 }} />
              <Text style={styles.savingsText}>
                You will save ₹{totalSavings.toFixed(2)} on this order!
              </Text>
            </View>
          )}
        </View>

        {/* Deliver to Section (Business Information + Delivery Address) */}
        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <View style={styles.addressHeaderLeft}>
              <MaterialIcons name="location-on" size={20} color="#007AFF" />
              <Text style={styles.addressSectionTitle}>Deliver to:</Text>
            </View>
            <TouchableOpacity style={styles.changeButton}>
              <Text style={styles.changeButtonText}>CHANGE</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressCard}>
            {/* Business Information Inputs */}
            <View style={styles.inputSection}>
              <Text style={styles.fieldLabel}>Contact Person <Text style={styles.requiredAsterisk}>*</Text></Text>
              <View style={[styles.inputGroup, errors.contactPerson && styles.inputError]}>
                <AntDesign name="user" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={contactPerson}
                  onChangeText={text => {
                    setContactPerson(text);
                    if (errors.contactPerson) setErrors(prev => ({ ...prev, contactPerson: '' }));
                  }}
                  placeholder="Enter name"
                  placeholderTextColor="#999"
                />
              </View>
              {errors.contactPerson ? <Text style={styles.errorTextSmall}>{errors.contactPerson}</Text> : null}

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>{(role || 'Customer').charAt(0).toUpperCase() + (role || 'Customer').slice(1)} Name <Text style={styles.requiredAsterisk}>*</Text></Text>
              <View style={[styles.inputGroup, errors.companyName && styles.inputError]}>
                <MaterialIcons name="business" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={distributorCompany}
                  onChangeText={text => {
                    setDistributorCompany(text);
                    if (errors.companyName) setErrors(prev => ({ ...prev, companyName: '' }));
                  }}
                  placeholder={`Enter ${role} name`}
                  placeholderTextColor="#999"
                />
              </View>
              {errors.companyName ? <Text style={styles.errorTextSmall}>{errors.companyName}</Text> : null}

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Delivery Address <Text style={styles.requiredAsterisk}>*</Text></Text>
              <View style={[styles.addressInputGroup, errors.deliveryAddress && styles.inputError]}>
                <MaterialIcons name="local-shipping" size={18} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.addressInput}
                  value={deliveryAddress}
                  onChangeText={text => {
                    setDeliveryAddress(text);
                    if (errors.deliveryAddress) setErrors(prev => ({ ...prev, deliveryAddress: '' }));
                  }}
                  placeholder="Street, House No, Area"
                  placeholderTextColor="#999"
                  multiline
                />
              </View>
              {errors.deliveryAddress ? <Text style={styles.errorTextSmall}>{errors.deliveryAddress}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Pincode <Text style={styles.requiredAsterisk}>*</Text></Text>
                  <View style={[styles.inputGroup, errors.pincode && styles.inputError]}>
                    <TextInput
                      style={styles.textInput}
                      value={pincode}
                      onChangeText={text => {
                        const numericValue = text.replace(/[^0-9]/g, '');
                        setPincode(numericValue);
                        if (numericValue.length === 6) checkPincode(numericValue);
                      }}
                      placeholder="Pincode"
                      keyboardType="numeric"
                      maxLength={6}
                    />
                    {pincodeLoading && <ActivityIndicator size="small" color="#007AFF" />}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>City</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => autoState ? setCityModalVisible(true) : showAlert('Notice', 'Select state first', 'info')}>
                    <Text style={[styles.dropdownValue, !autoCity && { color: '#999' }]}>{autoCity || 'City'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>State</Text>
                  <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setStateModalVisible(true)}>
                    <Text style={[styles.dropdownValue, !autoState && { color: '#999' }]}>{autoState || 'State'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* GST and Business Section inside Delivery Address */}
              <View style={styles.gstBusinessSection}>
                <Text style={styles.fieldLabel}>GST Number (Optional)</Text>
                <View style={styles.inputGroup}>
                  <MaterialIcons name="confirmation-number" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={gstNumber}
                    onChangeText={text => {
                      setGstNumber(text);
                      if (errors.gstNumber) setErrors(prev => ({ ...prev, gstNumber: '' }));
                    }}
                    placeholder="GSTIN"
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.gstNumber ? <Text style={styles.errorTextSmall}>{errors.gstNumber}</Text> : null}

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Business Address (Optional)</Text>
                <View style={styles.addressInputGroup}>
                  <MaterialIcons name="business" size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.addressInput}
                    value={businessAddress}
                    onChangeText={text => {
                      setBusinessAddress(text);
                      if (errors.businessAddress) setErrors(prev => ({ ...prev, businessAddress: '' }));
                    }}
                    placeholder="Official business address"
                    placeholderTextColor="#999"
                    multiline
                  />
                </View>
              </View>

              <View style={styles.saveInfoRow}>
                <Switch
                  value={saveInfo}
                  onValueChange={setSaveInfo}
                  thumbColor="#007AFF"
                  trackColor={{ false: '#E5E5E7', true: '#007AFF40' }}
                />
                <Text style={styles.saveInfoText}>Save this for faster checkout</Text>
              </View>

            </View>
          </View>
        </View>

        {/* Payment Options */}
        <View style={[styles.paymentSection, { marginBottom: 100 }]}>
          <Text style={styles.sectionTitle}>Payment Options</Text>
          
          <TouchableOpacity 
            style={[styles.paymentOption, selectedPayment === 'RAZORPAY' && styles.selectedPaymentOption]} 
            onPress={() => setSelectedPayment('RAZORPAY')}
          >
            <View style={styles.paymentRadioContainer}>
              <View style={[styles.paymentRadio, selectedPayment === 'RAZORPAY' && styles.paymentRadioActive]} />
            </View>
            <View style={styles.paymentContent}>
              <View style={styles.paymentRow}>
                <AntDesign name="credit-card" size={20} color="#333" />
                <Text style={styles.paymentTitle}>Razorpay (Cards, UPI, NetBanking)</Text>
              </View>
              <Text style={styles.paymentSubtitle}>Secure payment via Razorpay gateway</Text>
            </View>
          </TouchableOpacity>


        </View>


        <SearchableDropdown
          visible={stateModalVisible}
          onClose={() => setStateModalVisible(false)}
          onSelect={(selectedState) => {
            setAutoState(selectedState);
            setAutoCity('');
          }}
          data={states}
          title="Select State"
        />

        <SearchableDropdown
          visible={cityModalVisible}
          onClose={() => setCityModalVisible(false)}
          onSelect={(selectedCity) => setAutoCity(selectedCity)}
          data={autoState ? (stateCityData[autoState] || []) : []}
          title="Select City"
        />
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <Animated.View style={[
              styles.successIconContainer,
              { transform: [{ scale: successScale }] }
            ]}>
              <AntDesign name="check-circle" size={80} color="#2874f0" />
            </Animated.View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSubtitle}>Your order has been placed successfully.</Text>
            <View style={styles.successBadge}>
              <Text style={styles.successBadgeText}>Blue Shade Premium</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={alertConfig.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.alertOverlay}>
          <Animated.View style={[
            styles.alertContent,
            { transform: [{ scale: alertScale }] }
          ]}>
            <View style={[
              styles.alertIconContainer,
              { backgroundColor: alertConfig.type === 'success' ? '#e8f5e9' : alertConfig.type === 'error' ? '#ffeeee' : '#e3f2fd' }
            ]}>
              <AntDesign 
                name={alertConfig.type === 'success' ? 'check-circle' : alertConfig.type === 'error' ? 'exclamation-circle' : 'info-circle'} 
                size={34} 
                color={alertConfig.type === 'success' ? '#2e7d32' : alertConfig.type === 'error' ? '#d32f2f' : '#1976d2'} 
              />
            </View>
            <Text style={styles.alertTitle}>{alertConfig.title}</Text>
            <Text style={styles.alertMessage}>{alertConfig.message}</Text>
            <TouchableOpacity 
              style={[
                styles.alertButton,
                { backgroundColor: alertConfig.type === 'success' ? '#2e7d32' : alertConfig.type === 'error' ? '#ff3b30' : '#2874f0' }
              ]}
              onPress={hideAlert}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Place Order Button */}
      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceContainer}>
          <Text style={styles.bottomTotalMRP}>₹{totalMRP.toFixed(0)}</Text>
          <View style={styles.bottomPriceRow}>
            <Text style={styles.bottomPrice}>₹{total.toFixed(0)}</Text>
            <AntDesign name="info-circle" size={12} color="#007AFF" style={{ marginLeft: 4 }} />
          </View>
        </View>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handlePlaceOrder}
          disabled={initialLoading}
        >
          {initialLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  requiredAsterisk: {
    color: 'red',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  redeemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redeemButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  redeemInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  redeemInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    minWidth: 20,
    padding: 0,
  },
  maxPointsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '400',
  },
  maxButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  maxButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  coinMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 18,
    height: 18,
    backgroundColor: '#ff8903ff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  distributorBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8E5FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  distributorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  pointText: {
    fontSize: 16,
    marginLeft: 5,
    fontWeight: '600',
    color: '#000',
  },
  orderSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemEmoji: {
    width: 40,
    height: 40,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  paymentSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 12,
  },
  selectedPaymentOption: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF05',
  },
  paymentRadioContainer: {
    marginRight: 12,
  },
  paymentRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRadioActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  paymentContent: {
    flex: 1,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  paymentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  paymentSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  addressSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
  },
  addressHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  changeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  addressCard: {
    padding: 2,
  },
  inputSection: {
    marginTop: 4,
  },
  errorTextSmall: {
    fontSize: 11,
    color: '#FF3B30',
    marginTop: 4,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  disabledInput: {
    flex: 1,
    fontSize: 14,
    color: '#999',
    paddingVertical: 12,
  },
  addressInputGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  inputIcon: {
    marginRight: 8,
  },
  gstBusinessSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  phoneInput: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  inputValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  autoFillNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  infoIconText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  autoFillText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  locationButton: {
    padding: 4,
  },
  saveInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  saveInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  bottomPriceContainer: {
    justifyContent: 'center',
  },
  bottomPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomTotalMRP: {
    fontSize: 14,
    color: '#878787',
    textDecorationLine: 'line-through',
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  continueButton: {
    backgroundColor: '#2874f0',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#388e3c',
  },
  savingsText: {
    color: '#388e3c',
    fontSize: 12,
    fontWeight: '600',
  },
  redeemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  redeemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIconSmall: {
    marginRight: 4,
  },
  redeemText: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  dropdownItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  successBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  successBadgeText: {
    fontSize: 12,
    color: '#2874f0',
    fontWeight: '600',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  alertIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  alertButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CheckoutPage;
