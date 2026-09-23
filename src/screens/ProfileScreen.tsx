import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { launchImageLibrary, ImageLibraryOptions } from 'react-native-image-picker';
import { CustomAlert } from '../components/UI/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/index'; // your axios instance
import {
  CommonActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import MaterialIcons, {
  MaterialIconsIconName,
} from '@react-native-vector-icons/material-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import Lucide from '@react-native-vector-icons/lucide';
// -------- Types --------
interface UserProfile {
  _id: string;
  name: string;
  email: string;
  company: string;
  role: 'customer' | 'retailer' | 'distributor' | string;
  mobile: string;
  profileImage?: string;
  deliveryAddress?: string;
  businessAddress?: string;
  pincode?: string;
  city?: string;
  state?: string;
  uId?: number;
  rewardPoints?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

type roleOptions = {
  value: string;
  label: string;
  icon: MaterialIconsIconName;
}[];

type ProfileScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Profile'
>;

// -------- Component --------
export const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>({
    _id: '',
    name: '',
    email: '',
    company: '',
    role: 'customer',
    mobile: '',
    profileImage: '',
    deliveryAddress: '',
    businessAddress: '',
    pincode: '',
    city: '',
    state: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(
    null,
  );
 
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    showCancel?: boolean;
    onConfirm?: () => void;
    confirmText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });
 
  const showAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    showCancel = false,
    onConfirm?: () => void,
    confirmText?: string
  ) => {
    setAlertConfig({ visible: true, title, message, type, showCancel, onConfirm, confirmText });
  };
 
  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { setToken } = useAuth();

  const roleOptions: roleOptions = [
    { value: 'customer', label: 'Customer', icon: 'person' },
    { value: 'retailer', label: 'Retailer', icon: 'store' },
    { value: 'distributor', label: 'Distributor', icon: 'business' },
  ];

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, []),
  );

  // 🚀 Fetch Profile
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        const res = await api.get(`/user/getUser`);
        const profileData = res.data.data;
        console.log(profileData);
        profileData.role = user.role;

        setProfile(profileData);
        setOriginalProfile(profileData);
      }
    } catch (err) {
      console.log(err);
      showAlert('Error', 'Failed to fetch profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Save Profile
  const saveProfile = async () => {
    // Validation
    if (!profile.name.trim()) {
      showAlert('Validation Error', 'Name is required', 'error');
      return;
    }
    setSaving(true);

    try {
      // Using FormData if there's a local image to upload
      // Note: Adapt this based on exactly how your backend expects multipart/form-data
      const hasNewImage = profile.profileImage && !profile.profileImage.startsWith('http');
      
      if (hasNewImage) {
        const formData = new FormData();
        formData.append('deliveryAddress', profile.deliveryAddress || '');
        formData.append('businessAddress', profile.businessAddress || '');
        formData.append('name', profile.name);
        formData.append('company', profile.company);
        formData.append('pincode', profile.pincode || '');
        formData.append('city', profile.city || '');
        formData.append('state', profile.state || '');
        
        formData.append('profileImage', {
          uri: profile.profileImage,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);

        await api.put(`/user/updateUser`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        let payload = {
          deliveryAddress: profile.deliveryAddress,
          businessAddress: profile.businessAddress,
          name: profile.name,
          company: profile.company,
          pincode: profile.pincode,
          city: profile.city,
          state: profile.state,
        };
        await api.put(`/user/updateUser`, payload);
      }

      await AsyncStorage.setItem(
        'userData',
        JSON.stringify({ phone: profile.mobile, role: profile.role }),
      );

      setOriginalProfile(profile);
      setIsEditing(false);
      showAlert('Success', 'Profile updated successfully', 'success');
    } catch (err) {
      console.log(err);
      showAlert('Error', 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 🚀 Pick Image
  const handleImagePick = async () => {
    if (!isEditing) return;

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
    };

    const result = await launchImageLibrary(options);

    if (result.didCancel) {
      console.log('User cancelled image picker');
    } else if (result.errorMessage) {
      console.log('ImagePicker Error: ', result.errorMessage);
    } else if (result.assets && result.assets.length > 0) {
      const selectedImageUri = result.assets[0].uri;
      updateProfile('profileImage', selectedImageUri || '');
    }
  };

  // 🚀 Cancel Editing
  const cancelEditing = () => {
    if (originalProfile) {
      setProfile(originalProfile);
    }
    setIsEditing(false);
  };

  // 🚀 Logout
  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      'warning',
      true,
      async () => {
        try {
          await AsyncStorage.removeItem('userData');
          await AsyncStorage.removeItem('authToken');
          setToken(null);

          // Navigate to login screen
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            }),
          );

          showAlert('Success', 'Logged out successfully', 'success');
        } catch (err) {
          showAlert('Error', 'Failed to logout', 'error');
        }
      },
      'Logout'
    );
  };
 
  // 🚀 Contact Support
  const handleContactSupport = async () => {
    const email = 'Info@molimor.co';
    const subject = 'Support Request - Molimor App';
    const body = '';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
 
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No email app found to send support email.');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert('Error', 'Something went wrong while trying to contact support.');
    }
  };

  const updateProfile = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value,
        },
      }));
    } else {
      setProfile(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const getRoleIcon = (role: string): MaterialIconsIconName => {
    const roleOption: MaterialIconsIconName =
      roleOptions.find(option => option.value === role)?.icon || 'person';
    return roleOption;
  };

  const getRoleLabel = (role: string) => {
    const roleOption = roleOptions.find(option => option.value === role);
    return roleOption ? roleOption.label : 'Customer';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerActions}>
            {!isEditing ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={cancelEditing}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Profile Image & Basic Info */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.profileImageContainer} 
            onPress={isEditing ? handleImagePick : undefined}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            {profile.profileImage ? (
              <Image 
                source={{ uri: profile.profileImage.startsWith('http') || profile.profileImage.startsWith('file://') ? profile.profileImage.replace('localhost', '192.168.29.254') : `http://192.168.29.254:8001${profile.profileImage.startsWith('/') ? '' : '/'}${profile.profileImage}` }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            
            {isEditing && (
              <View style={styles.editImageOverlay}>
                <MaterialIcons name="camera-alt" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profile.name || 'User Name'}
            </Text>
            {/* <View style={styles.roleContainer}>
              <Text style={styles.roleText}>UId #{originalProfile?.uId}</Text>
            </View> */}
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={[styles.section, styles.pointSec]}>
            <Text style={styles.editImageText}>Reward Point</Text>
            <View style={styles.pointValue}>
              <View style={styles.coinIcon}>
                <Lucide name="badge-indian-rupee" size={12} color="#fff" />
              </View>
              <Text style={styles.summaryValue}>
                {originalProfile?.rewardPoints}
              </Text>
            </View>
          </View>
          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Personal Information</Text>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name <Text style={styles.requiredAsterisk}>*</Text></Text>
              <TextInput
                style={[styles.textInput, !isEditing && styles.disabledInput]}
                value={profile.name}
                onChangeText={text => updateProfile('name', text)}
                placeholder="Enter your full name"
                editable={isEditing}
                placeholderTextColor="#999"
              />
            </View>

            {/* Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number <Text style={styles.requiredAsterisk}>*</Text></Text>
              <TextInput
                style={[styles.textInput, styles.disabledInput]}
                value={profile.mobile}
                placeholder="123-456-7890"
                keyboardType="phone-pad"
                editable={false}
                placeholderTextColor="#999"
                maxLength={12}
              />
            </View>
          </View>

          {/* Business Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏢 Business Information</Text>

            {/* Role Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Role</Text>
              {isEditing ? (
                <View style={styles.roleSelector}>
                  {roleOptions.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.roleOption,
                        profile.role === option.value && styles.selectedRole,
                      ]}
                      onPress={() => updateProfile('role', option.value)}
                    >
                      <Text style={styles.roleOptionIcon}>
                        {' '}
                        <MaterialIcons
                          name={option.icon}
                          size={24}
                          color="#3b82f6"
                        />
                      </Text>
                      <Text
                        style={[
                          styles.roleOptionText,
                          profile.role === option.value &&
                            styles.selectedRoleText,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.roleDisplay}>
                  <Text style={styles.roleDisplayIcon}>
                    <MaterialIcons
                      name={getRoleIcon(profile.role)}
                      size={24}
                      color="#3b82f6"
                    />
                  </Text>
                  <Text style={styles.roleDisplayText}>
                    {getRoleLabel(profile.role)}
                  </Text>
                </View>
              )}
            </View>

            {/* Company Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Company Name</Text>
              <TextInput
                style={[styles.textInput, !isEditing && styles.disabledInput]}
                value={profile.company}
                onChangeText={text => updateProfile('company', text)}
                placeholder="Enter company name"
                editable={isEditing}
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Address Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Address Information</Text>

            {/* Delivery Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivery Address</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  !isEditing && styles.disabledInput,
                ]}
                value={profile.deliveryAddress}
                onChangeText={text => updateProfile('deliveryAddress', text)}
                placeholder="Enter delivery address"
                editable={isEditing}
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
                maxLength={250}
              />
            </View>

            {/* Business Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Address</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  !isEditing && styles.disabledInput,
                ]}
                value={profile.businessAddress}
                onChangeText={text => updateProfile('businessAddress', text)}
                placeholder="Enter business address"
                editable={isEditing}
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
                maxLength={250}
              />
            </View>

            {/* Pincode, City, State Row */}
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>Pincode</Text>
                <TextInput
                  style={[styles.textInput, !isEditing && styles.disabledInput]}
                  value={profile.pincode}
                  onChangeText={text => updateProfile('pincode', text)}
                  placeholder="Pincode"
                  editable={isEditing}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={[styles.textInput, !isEditing && styles.disabledInput]}
                  value={profile.city}
                  onChangeText={text => updateProfile('city', text)}
                  placeholder="City"
                  editable={isEditing}
                  placeholderTextColor="#999"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={[styles.textInput, !isEditing && styles.disabledInput]}
                  value={profile.state}
                  onChangeText={text => updateProfile('state', text)}
                  placeholder="State"
                  editable={isEditing}
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Contact Support Button */}
          <TouchableOpacity 
            style={styles.supportBtn} 
            onPress={handleContactSupport}
          >
            <Lucide name="mail" size={20} color="#fff" style={styles.supportBtnIcon} />
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </TouchableOpacity>
 
          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
 
      {/* Custom Alert Modal */}
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        confirmText={alertConfig.confirmText}
      />
    </KeyboardAvoidingView>
  );
};

// -------- Styles --------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
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
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  editBtnText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileHeader: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  pointValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  editImageText: {
    fontSize: 16,
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  roleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  formContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointSec: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectedRole: {
    borderColor: '#2196F3',
    backgroundColor: '#e3f2fd',
  },
  roleOptionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  coinIcon: {
    width: 15,
    height: 15,
    backgroundColor: '#ff8903ff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#666',
  },
  selectedRoleText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  roleDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  roleDisplayIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  roleDisplayText: {
    fontSize: 16,
    color: '#666',
  },
  actionButtons: {
    padding: 16,
  },
  logoutBtn: {
    backgroundColor: '#f44336',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  supportBtn: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  supportBtnIcon: {
    marginRight: 10,
  },
  supportBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
  requiredAsterisk: {
    color: 'red',
  },
});
