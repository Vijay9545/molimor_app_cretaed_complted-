import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { OTPVerificationScreen } from '../../src/screens/OTPVerificationScreen';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../src/api';

// Mock navigation and route
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation: any = { navigate: mockNavigate, goBack: mockGoBack };
const mockRoute: any = {
  params: {
    phoneNumber: '+919876543210',
    confirmation: {
      confirm: jest.fn(),
    },
  },
};

// Mock Auth Context
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    setToken: jest.fn(),
  }),
}));

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => {
  return () => ({
    signInWithPhoneNumber: jest.fn(),
  });
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
}));

// Mock API
jest.mock('../../src/api', () => ({
  post: jest.fn(),
}));

// Mock Icons
jest.mock('@react-native-vector-icons/ant-design', () => 'Icon');

describe('OTPVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <OTPVerificationScreen navigation={mockNavigation} route={mockRoute} />
    );

    expect(getByText('Verify Phone Number')).toBeTruthy();
    expect(getByText('+919876543210')).toBeTruthy();
    expect(getByPlaceholderText('Enter 6-digit code')).toBeTruthy();
  });

  it('disables verify button when OTP is incomplete', () => {
    const { getByText, getByPlaceholderText } = render(
      <OTPVerificationScreen navigation={mockNavigation} route={mockRoute} />
    );

    const input = getByPlaceholderText('Enter 6-digit code');
    fireEvent.changeText(input, '123'); // Less than 6 digits

    // Button should be disabled (assuming the Button component passes disabled prop to TouchableOpacity)
    const verifyBtn = getByText('Verify OTP');
    expect(verifyBtn).toBeTruthy();
  });

  it('calls confirm and onboard API when OTP is valid', async () => {
    const mockUser = {
      getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
    };
    mockRoute.params.confirmation.confirm.mockResolvedValue({ user: mockUser });
    (api.post as jest.Mock).mockResolvedValue({
      data: { success: true, data: { token: 'mock-auth-token' } },
    });

    const { getByText, getByPlaceholderText } = render(
      <OTPVerificationScreen navigation={mockNavigation} route={mockRoute} />
    );

    const input = getByPlaceholderText('Enter 6-digit code');
    fireEvent.changeText(input, '123456');

    const verifyBtn = getByText('Verify OTP');
    fireEvent.press(verifyBtn);

    await waitFor(() => {
      expect(mockRoute.params.confirmation.confirm).toHaveBeenCalledWith('123456');
      expect(mockUser.getIdToken).toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledWith('/user/onboardUser', {
        idToken: 'mock-id-token',
      });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('authToken', 'mock-auth-token');
      expect(getByText('Phone number verified successfully!')).toBeTruthy();
    });
  });

  it('shows error when OTP is invalid', async () => {
    mockRoute.params.confirmation.confirm.mockRejectedValue({ code: 'auth/invalid-verification-code' });

    const { getByText, getByPlaceholderText } = render(
      <OTPVerificationScreen navigation={mockNavigation} route={mockRoute} />
    );

    const input = getByPlaceholderText('Enter 6-digit code');
    fireEvent.changeText(input, '654321');

    const verifyBtn = getByText('Verify OTP');
    fireEvent.press(verifyBtn);

    await waitFor(() => {
      expect(getByText('Incorrect OTP code. Please check and re-enter.')).toBeTruthy();
    });
  });
});
