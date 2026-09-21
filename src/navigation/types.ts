export type RootStackParamList = {
  Login: undefined;
  OTPVerification: {
    phoneNumber: string;
    confirmation: any;
  };
  Home: undefined;
  Product: { productId: string };
  MainTabs: undefined;
  CheckoutPage: undefined;
  Cart: undefined;
  Profile: undefined
};