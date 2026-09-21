export interface Country {
  cca2: string;
  name: string;
  callingCode: string[];
  flag: string;
}

export interface LoginFormData {
  phoneNumber: string;
  countryCode: string;
}

export interface OTPData {
  otp: string;
  phoneNumber: string;
}