import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export const validatePhoneNumber = (phoneNumber: string, countryCode: string): string | null => {
  if (!phoneNumber.trim()) {
    return 'Phone number is required';
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber, countryCode as any);
    
    if (!parsed || !isValidPhoneNumber(phoneNumber, countryCode as any)) {
      return 'Please enter a valid phone number';
    }
    
    return null;
  } catch (error) {
    return 'Invalid phone number format';
  }
};

export const formatPhoneNumber = (phoneNumber: string, countryCode: string): string => {
  try {
    const parsed = parsePhoneNumber(phoneNumber, countryCode as any);
    return parsed ? parsed.formatNational() : phoneNumber;
  } catch {
    return phoneNumber;
  }
};