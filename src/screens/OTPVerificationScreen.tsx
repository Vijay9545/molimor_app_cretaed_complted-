import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import api from '../api';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import AntDesign from '@react-native-vector-icons/ant-design';
import { CustomAlert } from '../components/UI/CustomAlert';

type OTPVerificationNavigationProp = StackNavigationProp<
  RootStackParamList,
  'OTPVerification'
>;
type OTPVerificationRouteProp = RouteProp<
  RootStackParamList,
  'OTPVerification'
>;

interface Props {
  navigation: OTPVerificationNavigationProp;
  route: OTPVerificationRouteProp;
}

export const OTPVerificationScreen: React.FC<Props> = ({
  navigation,
  route,
}) => {
  const { phoneNumber, confirmation } = route.params;
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [confirmationObj, setConfirmationObj] = useState(confirmation);
  const { setToken } = useAuth();

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

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      showAlert('Error', 'Please enter a valid 6-digit OTP', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await confirmationObj.confirm(otp);
      const user = userCredential.user;
      const idToken = await user.getIdToken();

      const response = await api.post('/user/onboardUser', {
        idToken,
      });

      if (response.data.success) {
        await AsyncStorage.setItem('authToken', response.data.data.token);
        await AsyncStorage.setItem(
          'userData',
          JSON.stringify({ phone: phoneNumber, role: 'customer' }),
        );
        setToken(response.data.data.token);
        showAlert('Success', 'Phone number verified successfully!', 'success');
      }
    } catch (error: any) {
      console.error('OTP Verify Error:', error);
      let message = 'Invalid OTP. Please try again.';
      if (error?.code === 'auth/invalid-verification-code') {
        message = 'Incorrect OTP code. Please check and re-enter.';
      } else if (error?.code === 'auth/code-expired') {
        message = 'OTP has expired. Please request a new one.';
      } else if (error?.code === 'auth/session-expired') {
        message = 'Session expired. Please go back and request OTP again.';
      } else if (error?.code) {
        message = `Error: ${error.code}`;
      }
      showAlert('Verification Failed', message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setCanResend(false);
    setCountdown(60);

    const newConfirmation = await auth().signInWithPhoneNumber(phoneNumber);
    setConfirmationObj(newConfirmation);

    showAlert('Success', 'OTP sent again!', 'success');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Verify Phone Number</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          </Text>
        </View>

        <View style={styles.formContainer}>
          <Input
            label="Verification Code"
            value={otp}
            onChangeText={setOtp}
            placeholder="Enter 6-digit code"
            keyboardType="number-pad"
            maxLength={6}
          />

          <Button
            title="Verify OTP"
            onPress={handleVerifyOTP}
            loading={isLoading}
            disabled={otp.length !== 6}
          />

          <View style={styles.resendContainer}>
            {canResend ? (
              <TouchableOpacity onPress={handleResendOTP}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.countdownText}>
                Resend OTP in {countdown}s
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.changeNumberText}>Change phone number</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#3b82f6',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  resendText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  countdownText: {
    fontSize: 16,
    color: '#6b7280',
  },
  changeNumberText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 10,
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
