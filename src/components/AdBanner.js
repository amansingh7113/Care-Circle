import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../store/useStore';

const AdBanner = () => {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);

  // Do not show ads for Premium users or Patients
  if (currentCircle?.is_premium || user?.role === 'Patient') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.placeholderText}>Ad Banner Placeholder (Expo Go Mode)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  }
});

export default AdBanner;
