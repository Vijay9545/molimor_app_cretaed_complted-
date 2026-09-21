
export const formatPhoneNumber = (number: string, countryCode: string) => {
  const cleanNumber = number.replace(/\D/g, '');
  
  // Format based on country
  switch (countryCode) {
    case '1': // US/Canada
      if (cleanNumber.length <= 10) {
        if (cleanNumber.length > 6) {
          return cleanNumber.replace(/(\d{3})(\d{3})(\d+)/, '($1) $2-$3');
        } else if (cleanNumber.length > 3) {
          return cleanNumber.replace(/(\d{3})(\d+)/, '($1) $2');
        }
      }
      break;
    case '91': // India
      if (cleanNumber.length <= 10) {
        if (cleanNumber.length > 5) {
          return cleanNumber.replace(/(\d{5})(\d+)/, '$1 $2');
        }
      }
      break;
    default:
      return cleanNumber;
  }
  
  return cleanNumber;
};
