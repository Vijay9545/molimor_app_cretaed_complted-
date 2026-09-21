import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import CountryPicker, { Country  } from 'react-native-country-picker-modal';
import { formatPhoneNumber } from '../../utils/phoneValidation';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onCountryChange: (country: Country) => void;
  selectedCountry: Country;
  error?: string;
  label?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  onCountryChange,
  selectedCountry,
  error,
  label = 'Phone Number',
}) => {
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handlePhoneChange = (text: string) => {
    // Remove all non-digit characters for storage
    const cleanNumber = text.replace(/\D/g, '');
    onChangeText(cleanNumber);
  };

  const displayValue = formatPhoneNumber(value, selectedCountry.cca2);

  const getFlagEmoji = (countryCode: string) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[styles.inputContainer, error ? styles.inputError : {}]}>
        <TouchableOpacity
          style={styles.countryButton}
          onPress={() => setShowCountryPicker(true)}>
          <Text style={styles.flag}>{getFlagEmoji(selectedCountry.cca2)}</Text>
          <Text style={styles.callingCode}>
            +{selectedCountry.callingCode[0]}
          </Text>
          <Text style={styles.dropdown}>▼</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.phoneInput}
          value={displayValue}
          onChangeText={handlePhoneChange}
          placeholder="Enter phone number"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <CountryPicker
        visible={showCountryPicker}
        onSelect={onCountryChange}
        onClose={() => setShowCountryPicker(false)}
        withCallingCode
        withFlag
        withFilter
        countryCode={selectedCountry.cca2 as any}
        renderFlagButton={() => null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
  },
  flag: {
    fontSize: 18,
    marginRight: 8,
  },
  callingCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginRight: 8,
  },
  dropdown: {
    fontSize: 12,
    color: '#6b7280',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1f2937',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },
});