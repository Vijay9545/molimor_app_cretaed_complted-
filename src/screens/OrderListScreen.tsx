import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  Modal,
  Dimensions,
  RefreshControl,
  Animated,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Lucide from '@react-native-vector-icons/lucide';
import AntDesign from '@react-native-vector-icons/ant-design';
import api from '../api/index'; // your axios instance
import { useFocusEffect } from '@react-navigation/native';



const { width } = Dimensions.get('window');

// -------- Types --------
interface OrderItem {
  finalPrice: number;
  mrp: number;
  productId: string;
  price: number;
  title: string;
  mainImage: string;
  qty: number;
  type: 'retailer' | 'distributor' | 'customer';
}

interface Order {
  _id: string;
  orderStatus:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'placed'; // Added 'placed' based on JSON
  createdAt: string;
  updatedAt: string;
  usePoint: number;
  order: OrderItem[];
  totalAmount: number;
  address: string;
  deliveryAddress?: string;
  orderId: string;
  name: string;
  company: string;
  mobile?: string;
  pincode?: string;
  city?: string;
  state?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  shippingFee?: number;
  tax?: number;
  subtotal?: number;
  cancelReason?: string;
  cancelledAt?: string;
}



type FilterStatus =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

// -------- Component --------
export const OrderListScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>('all');
  const [totalSpend, setTotalSpend] = useState(0);

  // Custom Alert State
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
  const [orderDetailModal, setOrderDetailModal] = useState<{
    visible: boolean;
    order: Order | null;
  }>({ visible: false, order: null });

  const [trackingData, setTrackingData] = useState<any>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Cancellation State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const cancellationReasons = [
    "Expected delivery date has changed",
    "Price for the product has decreased",
    "I want to change the delivery address",
    "I want to change the contact and phone number",
    "Ordered by mistake",
    "I have changed my mind",
    "Found a better deal elsewhere",
    "Other"
  ];

  // Fetch tracking when modal opens with an order that has shiprocketShipmentId
  React.useEffect(() => {
    if (orderDetailModal.visible && orderDetailModal.order?._id && orderDetailModal.order?.shiprocketShipmentId) {
      fetchTracking(orderDetailModal.order._id);
    } else {
      setTrackingData(null);
    }
  }, [orderDetailModal.visible, orderDetailModal.order]);

  const fetchTracking = async (orderId: string) => {
    setTrackingLoading(true);
    try {
      const res = await api.get(`/order/track/${orderId}`);
      console.log('📦 Tracking API Response:', JSON.stringify(res.data, null, 2));
      if (res.data.success) {
        // Shiprocket backend returns { tracking_data: { ... } } inside our data field
        const trackData = res.data.data.tracking_data || res.data.data;
        setTrackingData(trackData);
      }
    } catch (err) {
      console.log('Tracking error:', err);
    }
    setTrackingLoading(false);
  };

  const handleCancelOrder = async () => {
    if (!orderDetailModal.order || !selectedCancelReason) return;

    try {
      setIsCancelling(true);
      const res = await api.post(`/order/cancel/${orderDetailModal.order._id}`, {
        cancelReason: selectedCancelReason
      });

      if (res.data.success) {
        setCancelModalVisible(false);
        // Update local order state so the UI reflects the cancellation immediately
        if (orderDetailModal.order) {
          setOrderDetailModal(prev => ({
            ...prev,
            order: { ...prev.order!, orderStatus: 'cancelled' }
          }));
        }
        showAlert('Success', 'Order cancelled successfully', 'success');
        fetchOrders(); // Refresh the list in the background
      } else {
        showAlert('Error', res.data.message || 'Failed to cancel order', 'error');
      }
    } catch (err: any) {
      console.log('Cancellation error:', err);
      showAlert('Error', err.response?.data?.message || 'Failed to cancel order', 'error');
    } finally {
      setIsCancelling(false);
    }
  };


  const filterOptions: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: 'All Orders', color: '#666' },
  ];

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, []),
  );

  // 🚀 Fetch Orders
  const fetchOrders = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get(`/order/getOrderList`);
      console.log('📋 Order List Response:', JSON.stringify(res.data, null, 2));
      const ordersData = res.data.data.orders || [];
      setTotalSpend(res.data.data.grandTotal);
      setOrders(ordersData);
    } catch (err) {
      console.log(err);
      showAlert('Error', 'Failed to fetch orders', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🚀 Reorder
  // Reorder functionality removed

  // 🚀 Helpers
  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    const statusColors: { [key: string]: string } = {
      pending: '#ff9800',
      placed: '#2874f0',
      confirmed: '#2196f3',
      processing: '#9c27b0',
      shipped: '#607d8b',
      delivered: '#4caf50',
      cancelled: '#f44336',
    };
    return statusColors[s] || '#666';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filter orders based on selected filter
  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'all') {
      return orders;
    }
    return orders.filter(order => order.orderStatus?.toLowerCase() === selectedFilter.toLowerCase());
  }, [orders, selectedFilter]);

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={filterOptions}
        keyExtractor={item => item.key}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterTab,
              selectedFilter === item.key && styles.activeFilterTab,
              selectedFilter === item.key && { borderBottomColor: item.color },
            ]}
            onPress={() => setSelectedFilter(item.key)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === item.key && styles.activeFilterText,
                selectedFilter === item.key && { color: item.color },
              ]}
            >
              {item.label}
            </Text>
            {item.key !== 'all' && (
              <Text style={styles.filterCount}>
                {orders.filter(order => order.orderStatus?.toLowerCase() === item.key.toLowerCase()).length}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderOrderItem = ({ item: order }: { item: Order }) => {
    const firstItem = order.order[0];

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => setOrderDetailModal({ visible: true, order })}
        activeOpacity={0.7}
      >
        <View style={styles.cardMainContent}>
          {/* Left: Product Image */}
          <View style={styles.cardImageContainer}>
            <Image
              source={{
                uri: firstItem?.mainImage || 'https://via.placeholder.com/80',
              }}
              style={styles.cardMainImage}
              resizeMode="cover"
            />
            {order.order.length > 1 && (
              <View style={styles.multipleItemsOverlay}>
                <Text style={styles.moreItemsText}>+{order.order.length - 1}</Text>
              </View>
            )}
          </View>

          {/* Right: Order Info */}
          <View style={styles.cardInfoContainer}>
            <View style={styles.cardInfoHeader}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {firstItem?.title || 'Order Item'}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  order.orderStatus?.toLowerCase() === 'placed' 
                    ? styles.placedBadge 
                    : { backgroundColor: getStatusColor(order.orderStatus) + '15' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: order.orderStatus?.toLowerCase() === 'placed' ? '#fff' : getStatusColor(order.orderStatus) },
                  ]}
                >
                  {order.orderStatus ? (order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1).toLowerCase()) : 'Status'}
                </Text>
              </View>
            </View>

            <View style={styles.cardInfoSubRow}>
              <Text style={styles.orderDateText}>{formatDate(order.createdAt)}</Text>
            </View>

            <View style={styles.cardPriceRow}>
              <Text style={styles.itemCountText}>
                {order.order.length} {order.order.length > 1 ? 'items' : 'item'}
              </Text>
              <Text style={styles.totalPriceText}>
                ₹{order.totalAmount.toFixed(2)}
              </Text>
            </View>

            {/* We are removing the recipient name from the main card as per user request to show 'Order Name' (Honey) instead of User Name */}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailsText}>View Order Details</Text>
          <Lucide name="chevron-right" size={16} color="#2196F3" />
        </View>
      </TouchableOpacity>
    );
  };

  const StatusTracker = ({ currentStatus, srStatus, trackingData, orderDate }: { currentStatus: string, srStatus?: string, trackingData?: any, orderDate?: string }) => {
    const statuses = ['pending', 'processing', 'shipped', 'delivered'];
    const labels = ['Ordered', 'Packed', 'Shipped', 'Delivered'];
    const icons: any[] = ['check', 'package', 'truck', 'home'];
    
    // Default index from internal status
    const lowerStatus = currentStatus?.toLowerCase();
    let currentIndex = statuses.indexOf(lowerStatus);
    if (lowerStatus === 'confirmed') currentIndex = 0;
    if (lowerStatus === 'pending') currentIndex = 0;

    // Overwrite with live Shiprocket status for real-time accuracy
    if (srStatus && typeof srStatus === 'string') {
      const s = srStatus.toLowerCase();
      if (s.includes('delivered')) currentIndex = 3;
      else if (s.includes('shipped') || s.includes('transit') || s.includes('out for delivery')) currentIndex = 2;
      else if (s.includes('picked up') || s.includes('ready to ship')) currentIndex = 1;
      else if (s.includes('awb assigned')) currentIndex = 0;
    }

    if (lowerStatus === 'cancelled' || (typeof srStatus === 'string' && srStatus.toLowerCase() === 'cancelled')) return null;

    // Helper to get latest activity for a specific milestone
    const getStageActivity = (index: number) => {
      if (!trackingData?.shipment_track_activities) return null;
      const activities = trackingData.shipment_track_activities;
      
      let match = null;
      if (index === 0) match = activities.find((a: any) => a.activity.toLowerCase().includes('placed') || a.activity.toLowerCase().includes('confirmed') || a.activity.toLowerCase().includes('processing'));
      if (index === 1) match = activities.find((a: any) => a.activity.toLowerCase().includes('picked up') || a.activity.toLowerCase().includes('packed') || a.activity.toLowerCase().includes('rts') || a.activity.toLowerCase().includes('pickup'));
      if (index === 2) match = activities.find((a: any) => a.activity.toLowerCase().includes('shipped') || a.activity.toLowerCase().includes('transit') || a.activity.toLowerCase().includes('reached'));
      if (index === 3) match = activities.find((a: any) => a.activity.toLowerCase().includes('delivered'));
      
      return match;
    };

    // Pulse animation for the active step
    const pulseAnim = useRef(new Animated.Value(1)).current;
    
    useEffect(() => {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }, [currentIndex, pulseAnim]);

    const activeColor = currentIndex === 3 ? '#1AAB40' : '#2874f0';

    return (
      <View style={styles.unifiedTrackerCard}>
        <View style={styles.trackerContainer}>
          {labels.map((label, index) => {
            const isCompleted = index <= currentIndex;
            const isActive = index === currentIndex;
            const isLast = index === labels.length - 1;
            const stageActivity = getStageActivity(index);
            
            return (
              <View key={label} style={styles.trackerStepContainer}>
                <View style={styles.trackerStep}>
                  {!isLast && (
                    <View 
                      style={[
                        styles.trackerLine, 
                        index < currentIndex ? { backgroundColor: activeColor } : styles.trackerLineInactive
                      ]} 
                    />
                  )}

                  <Animated.View 
                    style={[
                      styles.trackerDot, 
                      isCompleted ? { backgroundColor: activeColor, borderColor: activeColor } : styles.trackerDotInactive,
                      isActive && { transform: [{ scale: pulseAnim }], borderWidth: 2, borderColor: '#fff' }
                    ]} 
                  >
                    <Lucide 
                      name={icons[index]} 
                      size={index === 0 ? 10 : 12} 
                      color={isCompleted ? "#fff" : "#90a4ae"} 
                    />
                  </Animated.View>
                </View>
                <View style={styles.milestoneInfoContainer}>
                  <Text style={[styles.trackerLabel, isCompleted && { color: '#212121', fontWeight: 'bold' }]}>
                    {label}
                  </Text>
                  {stageActivity ? (
                    <Text style={styles.milestoneStatusSubtitle} numberOfLines={2}>
                      {stageActivity.activity}
                    </Text>
                  ) : index === 0 && (
                    <Text style={styles.milestoneStatusSubtitle}>{formatDate(orderDate || '')}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        
        {/* Latest High-Level Update Banner */}
        {trackingData?.shipment_track_activities && trackingData.shipment_track_activities[0] && (
          <View style={styles.latestUpdateBadge}>
            <Lucide name="info" size={12} color="#2874f0" />
            <Text style={styles.latestUpdateText}>
              Latest: {trackingData.shipment_track_activities[0].activity} {trackingData.shipment_track_activities[0].location !== 'NA' ? `at ${trackingData.shipment_track_activities[0].location}` : ''}
            </Text>
          </View>
        )}
      </View>
    );
  };



  const renderOrderDetailModal = () => {
    if (!orderDetailModal.order) return null;

    const order = orderDetailModal.order;
    const totalMRP = order.order.reduce((sum, item) => sum + (item.mrp * (item.qty || 1)), 0);
    const totalSavings = totalMRP - order.totalAmount;

    return (
      <Modal
        visible={orderDetailModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setOrderDetailModal({ visible: false, order: null })
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{order.order[0]?.title || 'Order Details'}</Text>
                <Text style={styles.modalOrderId}>ID: #{order.orderId}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  setOrderDetailModal({ visible: false, order: null })
                }
                style={styles.modalCloseBtn}
              >
                <Lucide name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalListContent}
              data={order.order}
              keyExtractor={(item: OrderItem) => item.productId}
              renderItem={({ item }: { item: OrderItem }) => (
                <View style={styles.orderItemCard} key={item.productId}>
                  <Image
                    source={{
                      uri: item.mainImage || 'https://via.placeholder.com/80',
                    }}
                    style={styles.orderItemImage}
                  />
                  <View style={styles.orderItemInfo}>
                    <Text style={styles.orderItemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.orderItemQty}>Qty: {item.qty}</Text>
                    <View style={styles.orderItemPriceRow}>
                      <Text style={styles.orderItemPrice}>₹{item.price}</Text>
                      {item.mrp > item.price && (
                        <Text style={styles.orderItemMrp}>₹{item.mrp}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
              ListHeaderComponent={() => {
                const orderStatus = order.orderStatus?.toLowerCase() || '';
                const isOrderDelivered = orderStatus === 'delivered';

                return (
                  <View>
                    <View style={styles.whiteSection}>
                      {orderStatus === 'cancelled' ? (
                        <View style={styles.cancelledBanner}>
                          <View style={styles.cancelledIconCircle}>
                            <Lucide name="circle-x" size={24} color="#fff" />
                          </View>
                          <View style={styles.cancelledTextContainer}>
                            <Text style={styles.cancelledTitle}>Order Cancelled</Text>
                            <Text style={styles.cancelledDate}>on {formatDate(order.updatedAt)}</Text>
                          </View>
                        </View>
                      ) : (
                        <View>
                          {/* Expected Delivery Display */}
                          {(trackingData?.etd || trackingData?.edd || trackingData?.expected_delivery_date || isOrderDelivered) && (
                            <View style={styles.etdContainer}>
                              <View style={styles.etdRow}>
                                <Lucide 
                                  name={isOrderDelivered ? "circle-check" : "truck"} 
                                  size={20} 
                                  color={isOrderDelivered ? "#1AAB40" : "#2874f0"} 
                                />
                                <Text style={styles.etdLabel}>
                                  {isOrderDelivered ? "Delivered on" : "Expected by"}
                                </Text>
                                <Text style={styles.etdDate}>
                                  {isOrderDelivered 
                                    ? formatDate(order.updatedAt) 
                                    : (() => {
                                        const rawDate = trackingData?.etd || trackingData?.edd || trackingData?.expected_delivery_date;
                                        if (rawDate) {
                                          return new Date(rawDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                        }
                                        return 'Calculating...';
                                      })()
                                  }
                                </Text>
                              </View>
                              {!isOrderDelivered && (
                                <Text style={styles.etdSubtext}>Your order is on the way!</Text>
                              )}
                            </View>
                          )}

                          <StatusTracker 
                            currentStatus={order.orderStatus || ''} 
                            srStatus={trackingData?.shipment_status} 
                            trackingData={trackingData}
                            orderDate={order.createdAt}
                          />
                        </View>
                      )}
                    </View>


                    <View style={styles.whiteSection}>
                      <View style={styles.sectionHeader}>
                        <Lucide name="map-pin" size={18} color="#2196F3" />
                        <Text style={styles.sectionTitle}>Delivery Address</Text>
                      </View>
                      <View style={styles.addressContainer}>
                        <Text style={styles.recipientName}>{order.name}</Text>
                        {order.company ? <Text style={styles.addressText}>{order.company}</Text> : null}
                        <Text style={styles.addressText}>{order.deliveryAddress || order.address}</Text>
                        {(order.city || order.state || order.pincode) && (
                          <Text style={styles.addressText}>
                            {order.city}{order.city && order.state ? ', ' : ''}{order.state} {order.pincode ? `- ${order.pincode}` : ''}
                          </Text>
                        )}
                        {order.mobile ? (
                          <Text style={[styles.addressText, { marginTop: 4, fontWeight: '500' }]}>
                            Phone: {order.mobile}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.whiteSection}>
                      <View style={styles.sectionHeader}>
                        <Lucide name="package" size={18} color="#2196F3" />
                        <Text style={styles.sectionTitle}>Order Items</Text>
                      </View>
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={() => (
                <View style={styles.modalFooter}>
                  <View style={styles.whiteSection}>
                    <View style={styles.sectionHeader}>
                      <Lucide name="receipt" size={18} color="#2196F3" />
                      <Text style={styles.sectionTitle}>Price Details</Text>
                    </View>
                    
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Items Subtotal</Text>
                      <Text style={styles.priceValue}>₹{(order.subtotal || (order.totalAmount - (order.tax || 0) - (order.shippingFee || 0))).toFixed(2)}</Text>
                    </View>

                    {Number(order.tax || 0) > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>GST / Tax</Text>
                        <Text style={styles.priceValue}>₹{Number(order.tax).toFixed(2)}</Text>
                      </View>
                    )}

                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Delivery Charges</Text>
                      <Text style={[styles.priceValue, (order.shippingFee || 0) === 0 && styles.freeText]}>
                        {(order.shippingFee || 0) > 0 ? `₹${Number(order.shippingFee).toFixed(2)}` : 'FREE'}
                      </Text>
                    </View>

                    {order.usePoint > 0 && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Rewards Redeemed</Text>
                        <Text style={[styles.priceValue, styles.discountText]}>-₹{order.usePoint.toFixed(2)}</Text>
                      </View>
                    )}

                    <View style={[styles.priceRow, styles.finalPriceRow]}>
                      <Text style={styles.finalPriceLabel}>Total Amount Paid</Text>
                      <Text style={styles.finalPriceValue}>₹{order.totalAmount.toFixed(2)}</Text>
                    </View>
                    
                    {totalSavings > 0 && (
                      <View style={styles.savingsContainer}>
                        <Text style={styles.savingsText}>
                          You saved ₹{totalSavings.toFixed(2)} on this order
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Cancel Button - Flipkart Style */}
                  {order.orderStatus?.toLowerCase() !== 'cancelled' && order.orderStatus?.toLowerCase() !== 'delivered' && (
                    <TouchableOpacity 
                      style={styles.cancelOrderBtn} 
                      onPress={() => setCancelModalVisible(true)}
                    >
                      <Lucide name="circle-x" size={18} color="#f44336" />
                      <Text style={styles.cancelOrderBtnText}>Cancel Order</Text>
                    </TouchableOpacity>
                  )}

                  <View style={{ height: 40 }} />
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptySubtitle}>
          Start shopping to see your orders here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders ({orders.length})</Text>
        <View>
          <Text style={styles.orderCount}>Total Spend</Text>
          <Text style={styles.spendColor}>₹{totalSpend}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={item => item._id}
        renderItem={renderOrderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders(true)}
            colors={['#2196F3']}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyFilterContainer}>
            <Text style={styles.emptyFilterText}>
              No {selectedFilter === 'all' ? '' : selectedFilter} orders found
            </Text>
          </View>
        )}
      />

      {/* Order Detail Modal */}
      {renderOrderDetailModal()}
      
      {/* Cancellation Reason Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cancel Order</Text>
                <Text style={styles.modalSubtitle}>Please select a reason for cancellation</Text>
              </View>
              <TouchableOpacity onPress={() => setCancelModalVisible(false)}>
                <Lucide name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
              {cancellationReasons.map((reason) => (
                <TouchableOpacity 
                  key={reason} 
                  style={[
                    styles.reasonItem,
                    selectedCancelReason === reason && styles.selectedReasonItem
                  ]} 
                  onPress={() => setSelectedCancelReason(reason)}
                >
                  <View style={[
                    styles.radioCircle,
                    selectedCancelReason === reason && styles.radioCircleSelected
                  ]}>
                    {selectedCancelReason === reason && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.reasonText,
                    selectedCancelReason === reason && styles.selectedReasonText
                  ]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooterActions}>
              <TouchableOpacity 
                style={styles.cancelBtnSecondary} 
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.cancelBtnSecondaryText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.confirmCancelBtn,
                  (!selectedCancelReason || isCancelling) && styles.disabledBtn
                ]} 
                onPress={handleCancelOrder}
                disabled={!selectedCancelReason || isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmCancelBtnText}>Confirm Cancellation</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal - Bottom Sheet Style */}
      <Modal
        visible={alertConfig.visible}
        transparent={true}
        animationType="slide"
        onRequestClose={hideAlert}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <View style={styles.modalDragHandle} />
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
              <Text style={styles.alertButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// -------- Styles --------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f3f6', // Flipkart background gray
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f3f6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2874f0', // Flipkart blue header
    borderBottomWidth: 1,
    borderBottomColor: '#2874f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  orderCount: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.8,
  },
  spendColor: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 4,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: '#2874f0',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#2874f0',
    fontWeight: 'bold',
  },
  filterCount: {
    display: 'none', // Hide count for cleaner UI
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyFilterContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyFilterText: {
    fontSize: 16,
    color: '#666',
  },
  orderCard: {
    backgroundColor: '#fff',
    marginBottom: 8,
    padding: 16,
  },
  cardMainContent: {
    flexDirection: 'row',
  },
  cardImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f8f9fa',
  },
  cardMainImage: {
    width: '100%',
    height: '100%',
  },
  multipleItemsOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  cardInfoContainer: {
    flex: 1,
    marginLeft: 16,
  },
  cardInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginRight: 8,
  },
  cardInfoSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  orderIdText: {
    fontSize: 12,
    color: '#757575',
  },
  dotSeparator: {
    marginHorizontal: 4,
    color: '#757575',
  },
  orderDateText: {
    fontSize: 12,
    color: '#757575',
  },
  cardPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemCountText: {
    fontSize: 12,
    color: '#757575',
  },
  totalPriceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  orderRecipient: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2874f0',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  moreItemsText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f1f3f6', // Flipkart gray
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
  },
  modalDragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOrderId: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalListContent: {
    paddingBottom: 60,
  },
  whiteSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
    marginLeft: 12,
  },
  // Tracker Styles
  trackerWrapper: {
    backgroundColor: '#fff',
    paddingBottom: 16,
  },
  // Unified Horizontal Tracker Styles
  unifiedTrackerCard: {
    backgroundColor: '#fff',
    paddingBottom: 20,
  },
  trackerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    backgroundColor: '#fff',
    paddingHorizontal: 5,
  },
  trackerStepContainer: {
    alignItems: 'center',
    flex: 1,
  },
  trackerStep: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trackerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  trackerDotInactive: {
    backgroundColor: '#eceff1',
    borderWidth: 1,
    borderColor: '#cfd8dc',
  },
  trackerLine: {
    height: 3,
    width: '100%',
    position: 'absolute',
    left: '50%',
    zIndex: 1,
  },
  trackerLineInactive: {
    backgroundColor: '#eeeeee',
  },
  milestoneInfoContainer: {
    alignItems: 'center',
    paddingHorizontal: 2,
    minHeight: 40,
  },
  trackerLabel: {
    fontSize: 10,
    color: '#757575',
    textAlign: 'center',
  },
  milestoneStatusSubtitle: {
    fontSize: 9,
    color: '#2874f0',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
    maxWidth: 80,
  },
  latestUpdateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0e5ff',
  },
  latestUpdateText: {
    fontSize: 11,
    color: '#2874f0',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  cancelledIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F56565',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cancelledTextContainer: {
    flex: 1,
  },
  cancelledTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#C53030',
  },
  cancelledDate: {
    fontSize: 13,
    color: '#E53E3E',
    marginTop: 2,
  },
  // Address Styles
  addressContainer: {
    marginLeft: 30,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  // Item Card Styles
  orderItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemImage: {
    width: 64,
    height: 64,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
  },
  orderItemInfo: {
    flex: 1,
    marginLeft: 16,
  },
  orderItemTitle: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 20,
  },
  orderItemQty: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  orderItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  orderItemMrp: {
    fontSize: 12,
    color: '#757575',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  // Price Details Styles
  modalFooter: {
    marginTop: 0,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#555',
  },
  priceValue: {
    fontSize: 14,
    color: '#212121',
  },
  discountText: {
    color: '#388e3c',
  },
  freeText: {
    color: '#388e3c',
  },
  finalPriceRow: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    marginTop: 4,
  },
  finalPriceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  finalPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  savingsContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderStyle: 'dashed',
  },
  savingsText: {
    color: '#388e3c',
    fontSize: 14,
  },
  // New Enhanced Tracking Styles
  trackingInfoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  trackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  trackingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
    marginLeft: 10,
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 80,
  },
  timelineLeftColumn: {
    alignItems: 'center',
    width: 20,
    marginRight: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
    zIndex: 1,
  },
  timelineDotActive: {
    backgroundColor: '#2874f0',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineDotLatest: {
    backgroundColor: '#2874f0',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e3f2fd',
    transform: [{ scale: 1.2 }],
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  milestoneBoxContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  milestoneBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 12,
    marginLeft: 4,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2874f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  milestoneBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
    paddingBottom: 8,
  },
  milestoneBoxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2874f0',
    marginLeft: 8,
  },
  milestoneBoxContent: {
    gap: 12,
  },
  milestoneActivityItem: {
    paddingLeft: 4,
  },
  milestoneActivityText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  milestoneDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  milestoneDateTextV2: {
    fontSize: 11,
    color: '#9e9e9e',
  },
  milestoneLocationTextV2: {
    fontSize: 11,
    color: '#2874f0',
    fontWeight: '500',
  },
  activitySeparator: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginTop: 10,
    width: '100%',
  },
  pendingTrackingCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderStyle: 'dashed',
  },
  noTrackingText: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  alertContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
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
  // ETD Styles
  etdContainer: {
    padding: 16,
    backgroundColor: '#f9fbfc',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8eff5',
  },
  etdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etdLabel: {
    fontSize: 15,
    color: '#212121',
    marginLeft: 10,
    fontWeight: '500',
  },
  etdDate: {
    fontSize: 15,
    color: '#212121',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  etdSubtext: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
    marginLeft: 30,
  },
  placedBadge: {
    backgroundColor: '#2874f0', // Flipkart Blue
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    elevation: 3, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  // Cancellation Modal Styles
  modalSubtitle: {
    fontSize: 13,
    color: '#757575',
    marginTop: 4,
  },
  reasonList: {
    padding: 16,
    backgroundColor: '#fff',
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f6',
  },
  selectedReasonItem: {
    backgroundColor: '#f9fbfc',
  },
  radioCircle: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#2874f0',
  },
  radioInner: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: '#2874f0',
  },
  reasonText: {
    fontSize: 14,
    color: '#212121',
  },
  selectedReasonText: {
    color: '#2874f0',
    fontWeight: '500',
  },
  modalFooterActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f3f6',
    gap: 12,
  },
  cancelBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dbdbdb',
  },
  cancelBtnSecondaryText: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '500',
  },
  confirmCancelBtn: {
    flex: 2,
    backgroundColor: '#fb641b', // Flipkart orange
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  confirmCancelBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledBtn: {
    backgroundColor: '#dbdbdb',
    opacity: 0.7,
  },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f44336',
    borderStyle: 'dashed',
  },
  cancelOrderBtnText: {
    fontSize: 14,
    color: '#f44336',
    fontWeight: '700',
    marginLeft: 8,
  },
});
