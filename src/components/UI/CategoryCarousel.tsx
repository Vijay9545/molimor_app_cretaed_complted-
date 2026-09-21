import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ProductCard } from '../ProductListing/ProductCard';
import { Product } from '../../types/Product';
import api from '../../api';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';

interface CategoryCarouselProps {
  categoryName: string;
  role: 'customer' | 'retailer' | 'distributor';
  onAddToCart: (product: Product) => void;
  loadingCarts: string;
}

export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  categoryName,
  role,
  onAddToCart,
  loadingCarts,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get(`/product/getProductList?categoryName=${categoryName}&type=${role}`);
        if (response.data.success) {
          setProducts(response.data.data.slice(0, 10)); // Limit to 10 products per carousel
        }
      } catch (error) {
        console.error(`Error fetching products for ${categoryName}:`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [categoryName, role]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" color="#2874f0" />
      </View>
    );
  }

  if (products.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{categoryName}</Text>
        <TouchableOpacity onPress={() => { /* Optional: Navigate to full list */ }}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ProductCard
              product={item}
              role={role}
              isAdding={loadingCarts === item._id}
              onAddToCart={onAddToCart}
              onPress={(p) => navigation.navigate('Product', { productId: p._id })}
              width={160}
            />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingLeft: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  viewAll: {
    fontSize: 14,
    color: '#2874f0',
    fontWeight: '600',
  },
  cardWrapper: {
    marginRight: 12,
  },
  loader: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
