import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../api/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../../screens/CartScreen'; // We can move types to a common file later

interface PricingTier {
  qty: number;
  price: number;
}

interface CartState {
  items: CartItem[];
  pricingData: { [key: string]: PricingTier[] };
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  pendingUpdates: { [key: string]: number };
}

const initialState: CartState = {
  items: [],
  pricingData: {},
  loading: false,
  initialLoading: true,
  error: null,
  pendingUpdates: {},
};

// 🚀 Async Thunks
export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (silent: boolean = false, { getState, rejectWithValue }) => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      const role = userData ? JSON.parse(userData).role : 'customer';
      
      const url = `/cart/getCart?type=${role}`;
      console.log('🔍 FETCHING CART FROM:', url);
      const res = await api.get(url);
      console.log('✅ CART RESPONSE:', {
        status: res.status,
        itemCount: res.data?.data?.cartItems?.length || 0,
        success: res.data?.success
      });
      const cartData = res.data.data.cartItems || [];
      
      // Fetch pricing for all products in cart
      const productIds = Array.from(new Set<string>(cartData.map((item: any) => item.productId._id)));
      let pricingData: { [key: string]: PricingTier[] } = {};
      
      if (productIds.length > 0) {
        const pricingPromises = productIds.map(id => {
          const pUrl = `/product/getProductPricing/${id}`;
          console.log('🔍 FETCHING PRICING:', pUrl);
          return api.get(pUrl).catch((err) => {
            console.error(`❌ PRICING ERROR for ${id}:`, err.message);
            return null;
          });
        });
        const results = await Promise.all(pricingPromises);
        results.forEach((res, index) => {
          if (res && res.data && res.data.success) {
            pricingData[productIds[index]] = res.data.data;
          }
        });
      }
      
      return { items: cartData, pricingData };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch cart');
    }
  }
);

export const syncCartItem = createAsyncThunk(
  'cart/syncCartItem',
  async ({ productId, qty, variantData }: { productId: string, qty: number, variantData: any }, { rejectWithValue }) => {
    try {
      await api.post('/cart/addToCart', {
        productId,
        qty,
        ...variantData,
        isUpdate: true,
      });
      return { productId, qty };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to sync cart');
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ productId, qty, role, variant }: { productId: string, qty: number, role: string, variant: any }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/cart/addToCart`, {
        productId,
        qty,
        [role]: variant,
      });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to add to cart');
    }
  }
);

export const deleteCartItem = createAsyncThunk(
  'cart/deleteCartItem',
  async (productId: string, { rejectWithValue }) => {
    try {
      const result = await api.delete(`/cart/deleteCart?productId=${productId}`);
      if (result.data.success) {
        return productId;
      }
      return rejectWithValue('Failed to delete item');
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to delete item');
    }
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // 🚀 Optimistic update for quantity
    updateQuantityOptimistic: (state, action: PayloadAction<{ cartItemId: string, productId: string, qty: number, variantData: any }>) => {
      const { cartItemId, productId, qty, variantData } = action.payload;
      
      // Mark as pending to prevent fetchCart from overwriting
      state.pendingUpdates[productId] = (state.pendingUpdates[productId] || 0) + 1;
      
      // Update the item quantity locally
      state.items = state.items.map(item => {
        if (item._id === cartItemId) {
          return {
            ...item,
            qty,
            customer: undefined,
            retailer: undefined,
            distributor: undefined,
            ...variantData
          };
        }
        return item;
      });
    },
    decrementPendingUpdate: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      state.pendingUpdates[productId] = Math.max(0, (state.pendingUpdates[productId] || 0) - 1);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Cart
      .addCase(fetchCart.pending, (state, action) => {
        const isSilent = action.meta.arg;
        if (!isSilent) {
          if (state.items.length === 0) state.initialLoading = true;
          else state.loading = true;
        }
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        const { items, pricingData } = action.payload;
        const isSilent = action.meta.arg;
        
        state.pricingData = pricingData;
        
        if (isSilent) {
            // Respect pending updates
            state.items = items.map((newItem: CartItem) => {
              const pendingCount = state.pendingUpdates[newItem.productId._id] || 0;
              if (pendingCount > 0) {
                const existingItem = state.items.find(i => i.productId._id === newItem.productId._id);
                return existingItem ? existingItem : newItem;
              }
              return newItem;
            });
        } else {
            state.items = items;
        }
        
        state.loading = false;
        state.initialLoading = false;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.initialLoading = false;
        state.error = action.payload as string;
      })
      
      // Sync Cart Item (handled via pendingUpdates in reducers)
      .addCase(syncCartItem.fulfilled, (state, action) => {
          const { productId } = action.meta.arg;
          state.pendingUpdates[productId] = Math.max(0, (state.pendingUpdates[productId] || 0) - 1);
      })
      .addCase(syncCartItem.rejected, (state, action) => {
          const { productId } = action.meta.arg;
          state.pendingUpdates[productId] = Math.max(0, (state.pendingUpdates[productId] || 0) - 1);
          state.error = action.payload as string;
      })
      
      // Add to Cart
      .addCase(addToCart.pending, (state) => {
          state.loading = true;
      })
      .addCase(addToCart.fulfilled, (state) => {
          state.loading = false;
          // We could try to update state optimistically here too, but simple 
          // fetchCart(true) after dispatch is safer for new items.
      })
      .addCase(addToCart.rejected, (state, action) => {
          state.loading = false;
          state.error = action.payload as string;
      })
      
      // Delete Cart Item
      .addCase(deleteCartItem.pending, (state, action) => {
          const productId = action.meta.arg;
          state.items = state.items.filter(item => item.productId._id !== productId);
      })
      .addCase(deleteCartItem.rejected, (state, action) => {
          state.error = action.payload as string;
          // Note: In a real app we might want to refetch the cart here to restore the item
      });
  },
});

export const { updateQuantityOptimistic, decrementPendingUpdate } = cartSlice.actions;
export default cartSlice.reducer;
