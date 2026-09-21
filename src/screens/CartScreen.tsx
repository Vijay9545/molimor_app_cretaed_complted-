import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  Dimensions,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/index';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import AntDesign from '@react-native-vector-icons/ant-design';
import {
  fetchCart,
  updateQuantityOptimistic,
  syncCartItem,
  deleteCartItem as deleteCartItemThunk
} from '../redux/slices/cartSlice';

const { width } = Dimensions.get('window');

// -------- Types --------
interface ProductVariant {
  qty: number;
  price: number;
  mrp: number;
  miniOrderQty: number;
}

interface Product {
  _id: string;
  title: string;
  mainImage: string;
  variants: {
    distributor: ProductVariant;
    retailer: ProductVariant;
    customer: ProductVariant;
  };
  gst?: string;
}

export interface CartItem {
  _id: string;
  productId: Product;
  qty: number;
  retailer?: ProductVariant;
  distributor?: ProductVariant;
  customer?: ProductVariant;
}

type CartScreenNavigationProp = StackNavigationProp<
  any,
  'Cart'
>;

export const CartScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: cart,
    loading,
    initialLoading,
    pricingData,
  } = useSelector((state: RootState) => state.cart);

  const [role, setRole] = useState<'customer' | 'retailer' | 'distributor'>('customer');
  const [isProcessingDelete, setIsProcessingDelete] = useState<{ [key: string]: boolean }>({});

  const navigation = useNavigation<CartScreenNavigationProp>();
  const debounceTimers = useRef<{ [key: string]: any }>({});

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
    showCancel?: boolean;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
  const alertScale = useState(new Animated.Value(0))[0];

  const showAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info' = 'info',
    showCancel = false,
    onConfirm?: () => void
  ) => {
    setAlertConfig({ visible: true, title, message, type, showCancel, onConfirm });
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

  useFocusEffect(
    useCallback(() => {
      async function getRole() {
        let userData = await AsyncStorage.getItem('userData');
        const currentRole = userData ? JSON.parse(userData).role : 'customer';
        setRole(currentRole);
      }
      dispatch(fetchCart(false));
      getRole();
    }, [dispatch]),
  );

  const getItemPrice = (item: CartItem) => {
    const tiers = pricingData[item.productId?._id];
    if (tiers && tiers.length > 0) {
      const sortedTiers = [...tiers].sort((a, b) => b.qty - a.qty);
      const matchedTier = sortedTiers.find(t => item.qty >= t.qty);
      if (matchedTier) return Number(matchedTier.price);
    }
    const itemVariant = item.customer || item.retailer || item.distributor;
    if (itemVariant && itemVariant.price) return Number(itemVariant.price);
    const productVariant = item.productId?.variants?.[role];
    if (productVariant && productVariant.price) return Number(productVariant.price);
    const anyVariant = item.productId?.variants?.customer ||
      item.productId?.variants?.retailer ||
      item.productId?.variants?.distributor;
    return Number(anyVariant?.price || 0);
  };

  const checkVariant = (item: CartItem, newQty: number) => {
    let customer = item.productId.variants.customer;
    let retailer = item.productId.variants.retailer;
    let distributor = item.productId.variants.distributor;
    if (newQty >= distributor.miniOrderQty) return { distributor };
    else if (newQty >= retailer.miniOrderQty) return { retailer };
    else return { customer };
  };

  const checkQnt = (item: CartItem, newQty: number) => {
    if (newQty > 0) return newQty;
    let customer = item.productId.variants.customer;
    let retailer = item.productId.variants.retailer;
    if (item.distributor) return item.qty - retailer.miniOrderQty;
    else if (item.retailer) return item.qty - customer.miniOrderQty;
    else return 0;
  };

  const updateCartQty = async (item: CartItem, newQty: number, isDelta = false) => {
    const itemId = item.productId._id;
    const cartItemId = item._id;
    let targetQty = isDelta ? item.qty + newQty : newQty;
    let realQty = checkQnt(item, targetQty);
    if (realQty <= 0 && !isDelta) return;

    const variantData = checkVariant(item, realQty);
    dispatch(updateQuantityOptimistic({
      cartItemId,
      productId: itemId,
      qty: realQty,
      variantData
    }));

    try {
      if (debounceTimers.current[itemId]) {
        clearTimeout(debounceTimers.current[itemId]);
      }

      debounceTimers.current[itemId] = setTimeout(async () => {
        try {
          await dispatch(syncCartItem({
            productId: itemId,
            qty: realQty,
            variantData
          }));
          dispatch(fetchCart(true));
        } catch (err) {
          console.log('Sync error:', err);
        } finally {
          delete debounceTimers.current[itemId];
        }
      }, 800);

    } catch (err) {
      dispatch(fetchCart(true));
      showAlert('Error', 'Failed to update cart', 'error');
    }
  };

  const deleteCartItem = async (itemId: string) => {
    if (isProcessingDelete[itemId]) return;

    showAlert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      'info',
      true,
      async () => {
        if (debounceTimers.current[itemId]) {
          clearTimeout(debounceTimers.current[itemId]);
          delete debounceTimers.current[itemId];
        }

        try {
          setIsProcessingDelete(prev => ({ ...prev, [itemId]: true }));
          await dispatch(deleteCartItemThunk(itemId)).unwrap();
          dispatch(fetchCart(true));
        } catch (err: any) {
          dispatch(fetchCart(true));
          if (err?.message !== 'Aborted') {
            showAlert('Error', 'Failed to delete item', 'error');
          }
        } finally {
          setIsProcessingDelete(prev => {
            const newState = { ...prev };
            delete newState[itemId];
            return newState;
          });
        }
      }
    );
  };

  const calcSubtotal = () => {
    return cart.reduce((sum, item) => {
      const price = getItemPrice(item);
      const qty = Number(item.qty || 0);
      return sum + (price * qty);
    }, 0);
  };

  const calcTax = (currentSubtotal: number) => {
    return cart.reduce((totalTax, item) => {
      let taxRate = 18; 
      const gstString = item.productId?.gst || "";
      const match = gstString.match(/\d+/);
      if (match) taxRate = parseFloat(match[0]);
      const price = getItemPrice(item);
      const qty = Number(item.qty || 0);
      const itemTax = (price * qty * taxRate) / 100;
      return totalTax + itemTax;
    }, 0);
  };

  const subtotal = calcSubtotal();
  const tax = calcTax(subtotal);
  const total = subtotal + tax;

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const price = getItemPrice(item);
    const itemTotal = price * item.qty;

    return (
      <View style={styles.cartItem}>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('Product', { productId: item.productId._id })
          }
        >
          <Image
            source={{
              uri: item.productId.mainImage || 'https://via.placeholder.com/60',
            }}
            style={styles.productImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <View style={styles.itemDetails}>
          <View style={styles.titleRow}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Product', { productId: item.productId._id })
                }
                style={{ flex: 1 }}
              >
                <Text style={styles.productTitle} numberOfLines={2}>
                  {item.productId.title}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteCartItem(item.productId._id)}
                style={styles.deleteBtn}
              >
                <AntDesign name="delete" size={20} color="#ff3b30" />
              </TouchableOpacity>
          </View>

          <View style={styles.priceAndStockRow}>
            <Text style={styles.unitPrice}>₹{price.toFixed(2)} per unit</Text>
            <View style={[styles.stockBadge, { backgroundColor: '#e8f5e8' }]}>
              <View style={[styles.stockDot, { backgroundColor: '#4caf50' }]} />
              <Text style={[styles.stockText, { color: '#4caf50' }]}>In Stock</Text>
            </View>
          </View>

          <View style={styles.quantityAndTotalRow}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => updateCartQty(item, -1, true)}
                disabled={item.qty <= 1}
              >
                <Text style={[styles.quantityBtnText, item.qty <= 1 && styles.disabledText]}>−</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.quantityInput}
                value={String(item.qty)}
                keyboardType="numeric"
                onChangeText={text => {
                  const cleanedText = text.replace(/[^0-9]/g, '');
                  const newQty = parseInt(cleanedText, 10);
                  if (!isNaN(newQty)) updateCartQty(item, newQty, false);
                  else if (cleanedText === '') updateCartQty(item, 0, false);
                }}
              />

              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() => updateCartQty(item, 1, true)}
              >
                <Text style={styles.quantityBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.totalContainer}>
                <Text style={styles.itemTotal} numberOfLines={1} adjustsFontSizeToFit>₹{itemTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderOrderSummary = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.summaryTitle}>Order Summary</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal ({cart.length} items)</Text>
        <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Estimated Tax</Text>
        <Text style={styles.summaryValue}>₹{tax.toFixed(2)}</Text>
      </View>
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
      </View>
    </View>
  );

  if (initialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2874f0" />
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  if (cart.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <AntDesign name="shopping-cart" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <TouchableOpacity 
          style={styles.shopNowBtn}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.shopNowBtnText}>Shop Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <Text style={styles.itemCount}>{cart.length} items</Text>
      </View>

      <FlatList
        data={cart}
        keyExtractor={item => item._id}
        renderItem={renderCartItem}
        ListFooterComponent={renderOrderSummary}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />

      <View style={styles.bottomTotal}>
        <Text style={styles.bottomTotalText}>Total</Text>
        <Text style={styles.bottomTotalAmount}>₹{total.toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={styles.checkoutButton}
        onPress={() => navigation.navigate('CheckoutPage')}
      >
        <Text style={styles.checkoutText}>Proceed to Checkout</Text>
      </TouchableOpacity>

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
            
            <View style={styles.alertButtonContainer}>
              {alertConfig.showCancel && (
                <TouchableOpacity 
                  style={[styles.alertButton, styles.alertCancelButton]}
                  onPress={hideAlert}
                >
                  <Text style={styles.alertCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[
                  styles.alertButton,
                  { backgroundColor: alertConfig.type === 'success' ? '#2e7d32' : alertConfig.type === 'error' ? '#ff3b30' : '#2874f0' },
                  alertConfig.showCancel && { flex: 1.5, marginLeft: 12 }
                ]}
                onPress={() => {
                  if (alertConfig.onConfirm) {
                    alertConfig.onConfirm();
                  }
                  hideAlert();
                }}
              >
                <Text style={styles.alertButtonText}>
                  {alertConfig.showCancel ? 'Confirm' : 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2874f0" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  shopNowBtn: {
    backgroundColor: '#2874f0',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 4,
  },
  shopNowBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    paddingBottom: 20,
    paddingTop: 8,
  },
  cartItem: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  priceAndStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  unitPrice: {
    fontSize: 13,
    color: '#878787',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
  },
  quantityAndTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f6',
    borderRadius: 6,
    padding: 2,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 4,
    elevation: 1,
  },
  quantityBtnText: {
    fontSize: 20,
    fontWeight: 'normal',
    color: '#212121',
  },
  disabledText: {
    color: '#ccc',
  },
  quantityInput: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
    marginHorizontal: 8,
    minWidth: 40,
    textAlign: 'center',
  },
  totalContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2874f0',
    textAlign: 'right',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#212121',
  },
  summaryValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2874f0',
  },
  bottomTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  bottomTotalText: {
    fontSize: 16,
    color: '#212121',
  },
  bottomTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2874f0',
  },
  checkoutButton: {
    backgroundColor: '#2874f0', // Premium Blue
    margin: 16,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 3,
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  alertButtonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  alertButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  alertCancelButton: {
    backgroundColor: '#f1f3f6',
    marginRight: 12,
    flex: 1,
  },
  alertCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
