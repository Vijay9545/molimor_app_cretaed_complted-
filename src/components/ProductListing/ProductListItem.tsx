import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { Product } from '../../types/Product';
import AntDesign from '@react-native-vector-icons/ant-design';

interface ProductListItemProps {
  product: Product;
  onPress: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  isAdding: boolean;
  role: 'customer' | 'retailer' | 'distributor';
}

export const ProductListItem: React.FC<ProductListItemProps> = ({
  product,
  onPress,
  onAddToCart,
  isAdding,
  role,
}) => {
  const getStockColor = () => {
    if (product.variants[role].qty > 0) {
      return '#10b981';
    } else {
      return '#ef4444';
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(product)}
      activeOpacity={0.9}
    >
      <View style={styles.content}>
        {/* Image Section */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.mainImage }}
            style={styles.productImage}
            resizeMode="contain"
          />
        </View>

        {/* Details Section */}
        <View style={styles.details}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.title}
          </Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{product.rating || '4.2'}</Text>
              <AntDesign name="star" size={10} color="#fff" />
            </View>
            <Text style={styles.ratingCount}>
              ({(product.reviewCount || 120).toLocaleString()})
            </Text>
          </View>

          {/* Highlights (Subtle) */}
          {product.highlights && product.highlights.length > 0 && (
            <Text style={styles.highlights} numberOfLines={1}>
              {product.highlights.join(' | ')}
            </Text>
          )}

          {/* Pricing */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{product.variants[role].price}</Text>
            <Text style={styles.originalPrice}>₹{product.variants[role].mrp}</Text>
            <Text style={styles.discountText}>
              {Math.round(
                ((product.variants[role].mrp - product.variants[role].price) /
                  product.variants[role].mrp) *
                  100,
              )}
              % off
            </Text>
          </View>

          <Text style={styles.minOrder}>
            Min Qty: {product.variants[role].miniOrderQty}
          </Text>

          {/* Add to Cart Button */}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
              product.variants[role].qty <= 0 && styles.disabledButton,
            ]}
            onPress={() => onAddToCart(product)}
            disabled={isAdding || product.variants[role].qty <= 0}
          >
            {({ pressed }) => (
              isAdding ? (
                <ActivityIndicator color={pressed ? "#fff" : "#2874f0"} size="small" />
              ) : (
                <Text
                  style={[
                    styles.addButtonText,
                    pressed && styles.addButtonTextPressed,
                    product.variants[role].qty <= 0 && styles.disabledButtonText,
                  ]}
                >
                  Add to Cart
                </Text>
              )
            )}
          </Pressable>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  imageContainer: {
    width: 100,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  details: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    color: '#212121',
    lineHeight: 20,
    marginBottom: 4,
    fontWeight: '400',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#388e3c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
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
  },
  highlights: {
    fontSize: 13,
    color: '#878787',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  originalPrice: {
    fontSize: 13,
    color: '#878787',
    textDecorationLine: 'line-through',
  },
  discountText: {
    fontSize: 13,
    color: '#388e3c',
    fontWeight: '600',
  },
  minOrder: {
    fontSize: 12,
    color: '#878787',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignSelf: 'flex-start',
  },
  addButtonPressed: {
    backgroundColor: '#2874f0',
    borderColor: '#2874f0',
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#eee',
  },
  addButtonText: {
    color: '#2874f0',
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonTextPressed: {
    color: '#fff',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
});
