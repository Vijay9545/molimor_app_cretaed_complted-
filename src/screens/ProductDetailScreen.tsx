import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { StackNavigationProp } from '@react-navigation/stack';
import AntDesign from '@react-native-vector-icons/ant-design';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../types/Product';
import { ProductCard } from '../components/ProductListing/ProductCard';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../redux/store';
import { addToCart, fetchCart } from '../redux/slices/cartSlice';
import { CategoryCarousel } from '../components/UI/CategoryCarousel';

const { width } = Dimensions.get('window');

type ProductDetailRouteProp = RouteProp<RootStackParamList, 'Product'>;

export const ProductDetailScreen: React.FC = () => {
  const route = useRoute<ProductDetailRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { productId } = route.params;
  const dispatch = useDispatch<AppDispatch>();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'customer' | 'retailer' | 'distributor'>('customer');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [loadingCarts, setLoadingCarts] = useState('');
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userFeedback, setUserFeedback] = useState('');
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [userName, setUserName] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);

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

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get role
      let userData = await AsyncStorage.getItem('userData');
      const currentRole = userData ? JSON.parse(userData).role : 'customer';
      setRole(currentRole);

      // Fetch user profile to get userName
      try {
          const userRes = await api.get('/user/getUser');
          if (userRes.data.success) {
              setUserName(userRes.data.data.name);
          }
      } catch (userErr) {
          console.error('Error fetching user profile:', userErr);
      }

      // Fetch product details
      const prodUrl = `/product/getProduct/${productId}`;
      const res = await api.get(prodUrl);
      if (res.data.success) {
        const productData = res.data.data;
        setProduct(productData);

        if (productData.categoryName) {
            const relatedRes = await api.get(`/product/getProductList?categoryName=${productData.categoryName}&type=${currentRole}`);
            if (relatedRes.data.success) {
                setRelatedProducts(relatedRes.data.data.filter((p: Product) => p._id !== productId));
            }
        }
        const recRes = await api.get(`/product/getProductList?type=${currentRole}`);
        if (recRes.data.success) {
            setRecommendations(recRes.data.data.filter((p: Product) => p._id !== productId).slice(0, 10));
        }

        // Fetch real ratings and reviews
        try {
            const ratingRes = await api.get(`/rating/product/${productId}`);
            if (ratingRes.data.success) {
                setReviews(ratingRes.data.data || []);
            }
        } catch (ratingErr) {
            console.error('Error fetching ratings:', ratingErr);
        }
      }
    } catch (err) {
      console.error('Error fetching product details:', err);
      showAlert('Error', 'Failed to load product details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (userRating === 0) {
      showAlert('Error', 'Please select a rating', 'error');
      return;
    }
    setIsSubmittingRating(true);
    try {
      const res = await api.post('/rating/add', { 
        productId, 
        rating: userRating, 
        review: userFeedback,
        userName: userName
      });
      
      if (res.data.success) {
          showAlert('Success', 'Thank you for your feedback!', 'success');
          setRatingModalVisible(false);
          setUserRating(0);
          setUserFeedback('');
          fetchData();
      } else {
          showAlert('Error', res.data.message || 'Failed to submit rating', 'error');
      }
    } catch (error: any) {
       console.error('Rating submission error:', error);
       showAlert('Error', error.response?.data?.message || 'Failed to submit rating', 'error');
    } finally {
       setIsSubmittingRating(false);
    }
  };

  const handleAddToCart = async (p?: Product) => {
    const productToAdd = p || product;
    if (!productToAdd) return;
    try {
      if (p) setLoadingCarts(p._id);
      else setIsAddingToCart(true);

      const result = await dispatch(addToCart({
        productId: productToAdd._id,
        qty: productToAdd.variants[role].miniOrderQty,
        role,
        variant: productToAdd.variants[role]
      })).unwrap();
      
      if (result.success) {
        dispatch(fetchCart(true));
        showAlert('Success', 'Added to cart', 'success');
      }
    } catch (error) {
      console.log(error);
      showAlert('Error', 'Failed to add to cart', 'error');
    } finally {
      if (p) setLoadingCarts('');
      else setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    try {
      setIsBuyingNow(true);
      const result = await dispatch(addToCart({
        productId: product._id,
        qty: product.variants[role].miniOrderQty,
        role,
        variant: product.variants[role]
      })).unwrap();
      
      if (result.success) {
        dispatch(fetchCart(true));
        navigation.navigate('MainTabs', { screen: 'Cart' });
      }

    } catch (error) {
      console.log(error);
      showAlert('Error', 'Failed to process Buy Now', 'error');
    } finally {
      setIsBuyingNow(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2874f0" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text>Product not found</Text>
      </View>
    );
  }

  const variant = product.variants[role];
  const productImages = product.images && product.images.length > 0 ? product.images : [product.mainImage];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <AntDesign name="arrow-left" size={24} color="#000" />
            </TouchableOpacity>
        </View>

        <View style={styles.carouselContainer}>
          <FlatList
            data={productImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveIndex(Math.floor(x / width + 0.5));
            }}
            scrollEventThrottle={16}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item || 'https://via.placeholder.com/400' }}
                style={styles.image}
                resizeMode="contain"
              />
            )}
          />
          {productImages.length > 1 && (
            <View style={styles.pagination}>
              {productImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    activeIndex === index ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{variant.price}</Text>
            <Text style={styles.mrp}>₹{variant.mrp}</Text>
            <Text style={styles.discount}>
              {Math.round(((variant.mrp - variant.price) / variant.mrp) * 100)}% off
            </Text>
          </View>
          
          <View style={styles.badgeContainer}>
             <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>
                    {reviews.length > 0 
                        ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1) 
                        : (product.rating || '0.0')}
                </Text>
                <AntDesign name="star" size={12} color="#fff" />
             </View>
             <Text style={styles.ratingCount}>{reviews.length.toLocaleString()} ratings</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <Text style={styles.description}>
                {product.description || `High quality ${product.title} with premium features. Category: ${product.categoryName || 'General'}`}
            </Text>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Highlights</Text>
            {(product.highlights && product.highlights.length > 0) ? (
                product.highlights.map((item, index) => (
                    <View key={index} style={styles.bulletRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.bulletText}>{item}</Text>
                    </View>
                ))
            ) : (
                ['Premium Quality', 'Durable Material', 'Fast Delivery', '100% Genuine'].map((item, index) => (
                    <View key={index} style={styles.bulletRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.bulletText}>{item}</Text>
                    </View>
                ))
            )}
        </View>

        {(product.benefits && product.benefits.length > 0) && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Benefits</Text>
                {product.benefits.map((benefit, index) => (
                    <View key={index} style={styles.benefitRow}>
                        <AntDesign name="check-circle" size={16} color="#388e3c" />
                        <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                ))}
            </View>
        )}

        {product.specifications && Object.keys(product.specifications).length > 0 && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specifications</Text>
                {Object.entries(product.specifications).map(([key, value], index) => (
                    <View key={index} style={styles.specRow}>
                        <Text style={styles.specTitle}>{key}</Text>
                        <Text style={styles.specValue}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                    </View>
                ))}
            </View>
        )}

        <View style={styles.section}>
            <View style={styles.reviewHeader}>
                <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
                <TouchableOpacity 
                    style={styles.rateBtn}
                    onPress={() => setRatingModalVisible(true)}
                >
                    <Text style={styles.rateBtnText}>Rate Product</Text>
                </TouchableOpacity>
            </View>
            
            <View style={styles.overallRating}>
                <View style={styles.bigRatingBox}>
                    <Text style={styles.bigRatingText}>
                        {reviews.length > 0 
                            ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1) 
                            : (product.rating || '0.0')}
                    </Text>
                    <AntDesign name="star" size={20} color="#000" />
                </View>
                <Text style={styles.totalReviews}>{reviews.length} ratings and {reviews.filter(r => r.review).length} reviews</Text>
            </View>

            {reviews.map((review, index) => (
                <View key={index} style={styles.reviewItem}>
                    <View style={styles.reviewUserRow}>
                        <View style={[styles.ratingBadge, { backgroundColor: review.rating >= 4 ? '#388e3c' : '#ff9f00' }]}>
                            <Text style={styles.ratingText}>{review.rating}</Text>
                            <AntDesign name="star" size={10} color="#fff" />
                        </View>
                        <Text style={styles.reviewUser}>{review.userName || 'Verified Buyer'}</Text>
                    </View>
                    <Text style={styles.reviewComment}>{review.review}</Text>
                    <Text style={styles.reviewDate}>Verified Purchase</Text>
                </View>
            ))}

            {reviews.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#878787', marginTop: 10 }}>No reviews yet. Be the first to rate!</Text>
            )}
        </View>

        {relatedProducts.length > 0 && (
            <View style={styles.relatedSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Similar Products</Text>
                </View>
                <FlatList
                    horizontal
                    data={relatedProducts}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <View style={styles.relatedCardItem}>
                             <ProductCard 
                                product={item} 
                                role={role} 
                                isAdding={false}
                                onAddToCart={() => {}} 
                                onPress={(p) => navigation.navigate('Product', { productId: p._id })} 
                                width={160}
                             />
                        </View>
                    )}
                    showsHorizontalScrollIndicator={false}
                />
            </View>
        )}

        <CategoryCarousel 
            categoryName="Groceries" 
            role={role} 
            onAddToCart={handleAddToCart} 
            loadingCarts={loadingCarts} 
        />
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.addToCartBtn} 
          onPress={() => handleAddToCart()} 
          disabled={isAddingToCart || isBuyingNow}
        >
          {isAddingToCart ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.addToCartText}>Add to Cart</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.buyNowBtn} 
          onPress={handleBuyNow}
          disabled={isAddingToCart || isBuyingNow}
        >
          {isBuyingNow ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buyNowText}>Buy Now</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.ratingOverlay}>
          <View style={styles.ratingModalContent}>
            <Text style={styles.modalTitle}>Rate this Product</Text>
            <View style={styles.starInputContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                  <AntDesign 
                    name="star" 
                    size={40} 
                    color={star <= userRating ? "#ff9f00" : "#dbdbdb"} 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Write your feedback here..."
              multiline
              numberOfLines={4}
              value={userFeedback}
              onChangeText={setUserFeedback}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setRatingModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, userRating === 0 && styles.disabledBtn]} 
                onPress={handleSubmitRating}
                disabled={isSubmittingRating || userRating === 0}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  backBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselContainer: {
    width: width,
    height: 400,
    position: 'relative',
  },
  image: {
    width: width,
    height: 400,
    backgroundColor: '#fff',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#2874f0',
    width: 20,
  },
  inactiveDot: {
    backgroundColor: '#C2C2C2',
  },
  infoContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    color: '#212121',
    lineHeight: 24,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  mrp: {
    fontSize: 16,
    color: '#878787',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  discount: {
    fontSize: 14,
    color: '#388e3c',
    fontWeight: '600',
    marginLeft: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#388e3c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 2,
  },
  ratingCount: {
    fontSize: 12,
    color: '#878787',
    marginLeft: 8,
  },
  divider: {
    height: 8,
    backgroundColor: '#f0f0f0',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d2d2d',
  },
  description: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#878787',
    marginRight: 12,
  },
  bulletText: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f1f8e9',
    padding: 12,
    borderRadius: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#33691e',
    marginLeft: 12,
    flex: 1,
  },
  specRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  specTitle: {
    flex: 1,
    fontSize: 14,
    color: '#878787',
  },
  specValue: {
    flex: 2,
    fontSize: 14,
    color: '#212121',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rateBtn: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  rateBtnText: {
    fontSize: 14,
    color: '#2874f0',
    fontWeight: '600',
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  bigRatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  bigRatingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212121',
  },
  totalReviews: {
    fontSize: 14,
    color: '#878787',
  },
  reviewItem: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  reviewComment: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#878787',
  },
  relatedSection: {
    paddingVertical: 16,
    paddingLeft: 16,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  sectionHeader: {
    paddingBottom: 12,
  },
  relatedCardItem: {
    marginRight: 10,
  },
  ratingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  ratingModalContent: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 8,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 20,
    textAlign: 'center',
  },
  starInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#fb641b',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledBtn: {
    backgroundColor: '#f5f5f5',
  },
  bottomBar: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 60,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addToCartBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  buyNowBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2874f0',
  },
  buyNowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
