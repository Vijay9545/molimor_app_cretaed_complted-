import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
} from 'react-native';
import AntDesign from '@react-native-vector-icons/ant-design';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type,
  onClose,
}) => {
  const [alertScale] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      alertScale.setValue(0);
      Animated.spring(alertScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, alertScale]);

  const handleClose = () => {
    Animated.timing(alertScale, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return {
          name: 'check-circle' as const,
          color: '#2e7d32',
          bgColor: '#e8f5e9',
          btnBg: '#2e7d32',
        };
      case 'error':
        return {
          name: 'exclamation-circle' as const,
          color: '#d32f2f',
          bgColor: '#ffeeee',
          btnBg: '#ff3b30',
        };
      default:
        return {
          name: 'info-circle' as const,
          color: '#1976d2',
          bgColor: '#e3f2fd',
          btnBg: '#2874f0',
        };
    }
  };

  const config = getIconConfig();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.alertOverlay}>
        <Animated.View
          style={[
            styles.alertContent,
            { transform: [{ scale: alertScale }] },
          ]}
        >
          <View
            style={[
              styles.alertIconContainer,
              { backgroundColor: config.bgColor },
            ]}
          >
            <AntDesign name={config.name} size={34} color={config.color} />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity
            style={[styles.alertButton, { backgroundColor: config.btnBg }]}
            onPress={handleClose}
          >
            <Text style={styles.alertButtonText}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  alertIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  alertButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
