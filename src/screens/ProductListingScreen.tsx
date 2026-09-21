import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Switch,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
} from 'react-native';
import AntDesign from '@react-native-vector-icons/ant-design';
import { Product } from '../types/Product';
import { ProductCard } from '../components/ProductListing/ProductCard';
import { ProductListItem } from '../components/ProductListing/ProductListItem';
import api from '../api';
import { buildQueryString, debounce } from '../utils/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../redux/store';
import { addToCart, fetchCart } from '../redux/slices/cartSlice';

export const ProductListingScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [products, setProducts] = useState<Product[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCarts, setLoadingCarts] = useState('');
  const [role, setRole] = useState<'customer' | 'retailer' | 'distributor'>(
    'customer',
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();

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
    async function getRole() {
      let userData = await AsyncStorage.getItem('userData');
      setRole(userData ? JSON.parse(userData).role : '');

      let result = await api.get('/category/getCategoryList');
      let finalValue = result.data.data.map((d: any) => d.name);
      setCategories(finalValue);
    }

    getRole();
  }, []);

  const [category, setCategory] = useState({
    categoryName: '',
    minPrice: '',
    maxPrice: '',
    miniOrderQty: '',
    search: '',
  });
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    getProductList();
  }, [category, role]);

  useFocusEffect(
    useCallback(() => {
      // If we have no products and it's not currently loading, try fetching on focus
      if (products.length === 0 && !loadingProducts) {
        console.log('🔄 Retrying product fetch on focus...');
        getProductList();
      }
    }, [products.length, loadingProducts])
  );

  const getProductList = async () => {
    try {
      if (products.length === 0) {
        setLoadingProducts(true);
      }
      const queryString = buildQueryString(category);
      let url = `/product/getProductList?type=${role}`;
      if (queryString) {
        url += `&${queryString}`;
      }
      
      const response = await api.get(url);
      if (response.data.success) {
        setProducts(response.data.data || []);
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch (error: any) {
      console.error('❌ PRODUCT LIST ERROR:', error);
      setFetchError(true);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchSuggestions = async (query: string) => {
    try {
      const response = await api.get(
        `/product/getProductList?type=${role}&search=${query}`,
      );
      if (response.data.success) {
        setSuggestions(response.data.data.slice(0, 8) || []);
      }
    } catch (error) {
      console.log('Error fetching suggestions:', error);
    }
  };

  const debouncedFetchSuggestions = React.useMemo(
    () => debounce((query: string) => fetchSuggestions(query), 500),
    [role],
  );

  const handleSuggestionPress = (suggestion: Product) => {
    setSearch(suggestion.title);
    setCategory({ ...category, search: suggestion.title });
    setShowSuggestions(false);
  };

  const handleProductPress = (product: Product) => {
    navigation.navigate('Product', { productId: product._id });
  };

  const handleAddToCart = async (product: Product) => {
    try {
      setLoadingCarts(product._id);
      const result = await dispatch(addToCart({
        productId: product._id,
        qty: product.variants[role].miniOrderQty,
        role,
        variant: product.variants[role]
      })).unwrap();
      
      if (result.success) {
        dispatch(fetchCart(true));
        showAlert('Added to Cart', `${product.title} added to cart!`, 'success');
      }
    } catch (error) {
      console.log(error);
      showAlert('Error', 'Failed to add to cart', 'error');
    } finally {
      setLoadingCarts('');
    }
  };

  const renderGridItem = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={handleProductPress}
      onAddToCart={handleAddToCart}
      isAdding={loadingCarts === item._id}
      role={role}
    />
  );

  const renderListItem = ({ item }: { item: Product }) => (
    <ProductListItem
      product={item}
      onPress={handleProductPress}
      onAddToCart={handleAddToCart}
      isAdding={loadingCarts === item._id}
      role={role}
    />
  );

  const clearFilters = () => {
    setCategory({
      categoryName: '',
      minPrice: '',
      maxPrice: '',
      miniOrderQty: '',
      search: search,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={search}
          onChangeText={text => {
            setSearch(text);
            if (text.length > 0) {
              debouncedFetchSuggestions(text);
              setShowSuggestions(true);
            } else {
              setSuggestions([]);
              setShowSuggestions(false);
              setCategory({ ...category, search: '' });
            }
          }}
          onSubmitEditing={() => {
            setCategory({ ...category, search });
            setShowSuggestions(false);
          }}
        />
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterVisible(true)}
        >
          <AntDesign name="filter" size={20} color="#2874f0" />
        </TouchableOpacity>
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(item)}
              >
                <AntDesign
                  name="search"
                  size={16}
                  color="#878787"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.suggestionText} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.suggestionsList}
          />
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Products</Text>
          <Text style={styles.subtitle}>
            {products.length} products available
          </Text>
        </View>

        <TouchableOpacity
          style={styles.singleToggleButton}
          onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
        >
          <AntDesign
            name={viewMode === 'grid' ? 'bars' : 'appstore'}
            size={20}
            color="#2874f0"
          />
        </TouchableOpacity>
      </View>

      {loadingProducts ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : products.length > 0 ? (
        <FlatList
          data={products}
          keyExtractor={item => item._id.toString()}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={viewMode === 'grid' ? styles.row : undefined}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.noDataContainer}>
          {fetchError ? (
            <>
              <AntDesign name="disconnect" size={48} color="#878787" style={{ marginBottom: 16 }} />
              <Text style={styles.noDataText}>Failed to load products.</Text>
              <Text style={[styles.noDataText, { fontSize: 12, marginTop: 8 }]}>
                Check your internet connection or focus back to retry.
              </Text>
            </>
          ) : (
            <Text style={styles.noDataText}>No products found.</Text>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={filterVisible}
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.filterTitle}>Filter Products</Text>
                <View style={styles.categoryContainer}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        category.categoryName === cat && styles.activeChip,
                      ]}
                      onPress={() =>
                        setCategory({ ...category, categoryName: cat })
                      }
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          category.categoryName === cat &&
                            styles.activeChipText,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={clearFilters}
                  >
                    <Text style={styles.clearText}>Clear All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => setFilterVisible(false)}
                  >
                    <Text style={styles.applyText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f3f6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2874f0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 2,
    paddingHorizontal: 15,
    fontSize: 14,
  },
  filterButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 2,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
  },
  subtitle: {
    fontSize: 12,
    color: '#878787',
    marginTop: 2,
  },
  singleToggleButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  listContainer: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#212121',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    margin: 4,
    backgroundColor: '#fff',
  },
  activeChip: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2874f0',
  },
  categoryText: {
    fontSize: 14,
    color: '#212121',
  },
  activeChipText: {
    color: '#2874f0',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  clearText: {
    color: '#212121',
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    backgroundColor: '#fb641b',
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 16,
    color: '#878787',
    textAlign: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#212121',
    flex: 1,
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
