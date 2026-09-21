import axios from "axios";
import auth from "@react-native-firebase/auth";
import Config from "react-native-config";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Create axios instance
const api = axios.create({
  baseURL: Config.API_BASE_URL || "https://channelflow-backend.onrender.com/api",
  timeout: 30000, // increased timeout
  headers: {
    "Content-Type": "application/json",
  },
});

console.log('📡 CONFIG OBJECT:', Config);
console.log('🌐 FINAL API BASE URL:', api.defaults.baseURL);
if (!Config.API_BASE_URL) {
  console.warn('⚠️ Config.API_BASE_URL is undefined, using fallback!');
}

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    // 1. Check if we have an internal backend token first
    const authToken = await AsyncStorage.getItem("authToken");
    
    // 2. If it's a login/onboard request, use the Firebase ID token
    if (config.url?.includes('/user/onboardUser')) {
       const currentUser = auth().currentUser;
       if (currentUser) {
         const idToken = await currentUser.getIdToken(); // No 'true' to avoid force refresh
         config.headers.Authorization = `Bearer ${idToken}`;
       }
    } 
    // 3. For all other requests, use the backend token if available
    else if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    // Log full request details for debugging
    console.log('📡 REQUEST:', {
      url: config.url,
      method: config.method,
      hasAuth: !!config.headers.Authorization
    });
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor (optional: for logging or refresh handling)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Example: handle 401 Unauthorized globally
    if (error.response?.status === 401) {
      console.warn("Unauthorized - maybe token expired?");
      // You could refresh token or redirect to login here
    }
    return Promise.reject(error);
  }
);

export default api;
