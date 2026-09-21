import React from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
  Pressable,
} from 'react-native';
import Icon from '@react-native-vector-icons/ant-design';

interface SalePopupProps {
  isVisible: boolean;
  onClose: () => void;
  onPressAction?: () => void;
  imageUrl?: string;
  offers?: string[];
  title?: string;
  description?: string;
}

const SalePopup: React.FC<SalePopupProps> = ({ isVisible, onClose, onPressAction, imageUrl, offers, title, description }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Banner Image */}
          <Pressable onPress={onPressAction} style={styles.content}>
            <Image
              source={imageUrl ? { uri: imageUrl } : require('../../assets/sale_banner.jpg')}
              style={styles.image}
              resizeMode="contain"
            />
            
            {(title || description || (offers && offers.length > 0)) && (
              <View style={styles.body}>
                {title && <Text style={styles.title}>{title}</Text>}
                {description && <Text style={styles.description}>{description}</Text>}
                
                {offers && offers.length > 0 && (
                  <View style={styles.offersContainer}>
                    {offers.map((offer, index) => (
                      <View key={index} style={styles.offerItem}>
                        <Icon name="star" size={14} color="#ff4d4d" />
                        <Text style={styles.offerText}>{offer}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>TAP TO EXPLORE OFFERS</Text>
              <Icon name="arrow-right" size={16} color="#fff" />
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    borderRadius: 20,
    overflow: 'visible',
    position: 'relative',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: -45,
    right: 0,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  content: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fff',
  },
  footer: {
    backgroundColor: '#ff4d4d',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    letterSpacing: 1,
  },
  body: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  offersContainer: {
    marginTop: 10,
  },
  offerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default SalePopup;
