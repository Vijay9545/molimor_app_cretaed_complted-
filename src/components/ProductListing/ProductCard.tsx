import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Product } from '../../types/Product';
import AntDesign from '@react-native-vector-icons/ant-design';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  isAdding: boolean;
  role: 'customer' | 'retailer' | 'distributor';
  width?: number; // Optional forced width
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 cards per row with padding

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  isAdding,
  role,
  width: forcedWidth,
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
      style={[styles.card, forcedWidth ? { width: forcedWidth } : null]}
      onPress={() => onPress(product)}
      activeOpacity={0.9}
    >
      {/* Image Section */}
      <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.mainImage }}
            style={styles.productImage}
            resizeMode="contain"
          />
      </View>

      {/* Content Section */}
      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.title}
        </Text>
        
        {/* Rating and Stock */}
        <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>{product.rating || '4.2'}</Text>
                <AntDesign name="star" size={10} color="#fff" />
            </View>
            <Text style={styles.ratingCount}>({(product.reviewCount || 120).toLocaleString()})</Text>
        </View>

        {/* Pricing */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.variants[role].price}</Text>
          <Text style={styles.originalPrice}>₹{product.variants[role].mrp}</Text>
          <Text style={styles.discountText}>
              {Math.round(((product.variants[role].mrp - product.variants[role].price) / product.variants[role].mrp) * 100)}% off
          </Text>
        </View>

        {/* Min Qty */}
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    width: cardWidth,
  },
  imageContainer: {
    height: 160,
    backgroundColor: '#fff',
    padding: 10,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    color: '#212121',
    lineHeight: 18,
    marginBottom: 6,
    height: 36, // Keep height consistent for 2 lines
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#388e3c',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 2,
  },
  ratingCount: {
    fontSize: 11,
    color: '#878787',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  originalPrice: {
    fontSize: 12,
    color: '#878787',
    textDecorationLine: 'line-through',
  },
  discountText: {
    fontSize: 12,
    color: '#388e3c',
    fontWeight: '600',
  },
  minOrder: {
    fontSize: 11,
    color: '#878787',
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    fontSize: 13,
    fontWeight: '600',
  },
  addButtonTextPressed: {
    color: '#fff',
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
});
