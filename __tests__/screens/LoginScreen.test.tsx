import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../src/screens/LoginScreen';
import auth from '@react-native-firebase/auth';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation: any = { navigate: mockNavigate };

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => {
  const signInWithPhoneNumber = jest.fn();
  return () => ({
    signInWithPhoneNumber,
  });
});

// Mock Icons
jest.mock('@react-native-vector-icons/ant-design', () => 'Icon');

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    expect(getByText('Login / Signup')).toBeTruthy();
    expect(getByPlaceholderText('9876543210')).toBeTruthy();
  });

  it('shows error when phone number is invalid', async () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    const input = getByPlaceholderText('9876543210');
    fireEvent.changeText(input, '12345'); // Less than 10 digits

    const submitBtn = getByText('Send OTP');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      // The alert should show Error
      expect(getByText('Please enter a valid phone number')).toBeTruthy();
    });
  });

  it('calls signInWithPhoneNumber and navigates on success', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({ verificationId: '12345' });
    (auth as unknown as jest.Mock).mockReturnValue({
      signInWithPhoneNumber: mockSignIn,
    });

    const { getByText, getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    const input = getByPlaceholderText('9876543210');
    fireEvent.changeText(input, '9876543210'); // Valid 10 digits

    const submitBtn = getByText('Send OTP');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('+919876543210');
      expect(mockNavigate).toHaveBeenCalledWith('OTPVerification', {
        phoneNumber: '+919876543210',
        confirmation: { verificationId: '12345' },
      });
    });
  });

  it('shows error if signInWithPhoneNumber fails', async () => {
    const mockSignIn = jest.fn().mockRejectedValue({ code: 'auth/invalid-phone-number' });
    (auth as unknown as jest.Mock).mockReturnValue({
      signInWithPhoneNumber: mockSignIn,
    });

    const { getByText, getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    const input = getByPlaceholderText('9876543210');
    fireEvent.changeText(input, '0000000000'); 

    const submitBtn = getByText('Send OTP');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('The phone number entered is invalid.')).toBeTruthy();
    });
  });
});
