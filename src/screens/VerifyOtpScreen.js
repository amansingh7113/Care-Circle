import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyOtp } from '../services/authApi';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';

const VerifyOtpScreen = ({ route, navigation }) => {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }
    
    setLoading(true);
    try {
      const response = await verifyOtp(phone, code);
      if (response.token) {
        await AsyncStorage.setItem('userToken', response.token);
        useStore.getState().setSession(response.token);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Successfully signed in!');
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Verify Code</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>
        
        <TextInput
          style={styles.input}
          placeholder="6-digit code"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify & Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 8,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#1A73E8', // Google Blue
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VerifyOtpScreen;
