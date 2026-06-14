import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { sendOtp, exchangeSession } from '../services/authApi';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';

// Ensure the browser closes when returning to the app
WebBrowser.maybeCompleteAuthSession();

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  React.useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      console.log('LoginScreen caught deep link URL:', url);
      
      const paramsString = url.split('#')[1] || url.split('?')[1];
      if (paramsString) {
        const match = paramsString.match(/access_token=([^&]+)/);
        if (match && match[1]) {
          setGoogleLoading(true);
          try {
            const accessToken = match[1];
            const exchangeData = await exchangeSession(accessToken);
            if (exchangeData.token) {
              await AsyncStorage.setItem('userToken', exchangeData.token);
              useStore.getState().setSession(exchangeData.token);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Successfully signed in!');
            }
          } catch (err) {
            console.error('Exchange error:', err);
            Alert.alert('Error', 'Failed to authenticate: ' + (err.response?.data?.error || err.message));
          } finally {
            setGoogleLoading(false);
          }
        } else if (url.includes('code=')) {
          Alert.alert('PKCE Error', 'Supabase returned a code instead of an access token. We need to disable PKCE.');
        }
      }
    };

    // Check if app was opened by a deep link
    Linking.getInitialURL().then(handleUrl);

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    try {
      await sendOtp(phone);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate('VerifyOtp', { phone });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    console.log('Initiating Google Login...');
    try {
      // Use the HARDCODED scheme that we know is registered in the Supabase Dashboard
      // changed from carecircle://auth/callback to carecircle://auth to match carecircle://*
      const redirectUri = 'carecircle://auth';
      console.log('Using static Redirect URI:', redirectUri);
      
      // Use local Supabase client so PKCE code challenge and state are properly generated!
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'consent' }
        }
      });
      
      if (error) throw error;
      
      console.log('Google Auth Response URL:', data?.url);
      if (data && data.url) {
        // Use WebBrowser which natively catches custom schemes and bypasses Chrome's redirect block
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        console.log('WebBrowser Result:', result);
        
        if (result.type === 'success' && result.url) {
          // Extract access token manually from the Implicit Flow URL to prevent Supabase JS crashes
          const url = result.url;
          const paramsString = url.split('#')[1] || url.split('?')[1];
          if (paramsString) {
            const match = paramsString.match(/access_token=([^&]+)/);
            if (match && match[1]) {
              const accessToken = match[1];
              try {
                // Exchange session with our custom backend
                const exchangeData = await exchangeSession(accessToken);
                if (exchangeData.token) {
                  await AsyncStorage.setItem('userToken', exchangeData.token);
                  useStore.getState().setSession(exchangeData.token);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Success', 'Successfully signed in!');
                }
              } catch (exchangeError) {
                console.error('Exchange error:', exchangeError);
                Alert.alert('Network Timeout', 'The backend is waking up. Please press Continue with Google again!');
              }
            }
          }
        }
      } else {
        Alert.alert('Error', 'Failed to get Google Auth URL');
      }
    } catch (error) {
      console.error('Google Auth Error:', error);
      Alert.alert('Error', error.message || 'Failed to initialize Google Login');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to CareCircle</Text>
        <Text style={styles.subtitle}>Enter your phone number to get started</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Phone Number (e.g., +919876543210)"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoCapitalize="none"
        />
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Verification Code</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity 
          style={styles.googleButton} 
          onPress={handleGoogleLogin}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#333" />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
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
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#1A73E8', // Google Blue as per PRD constraints
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48, // 48dp constraint
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  googleButton: {
    backgroundColor: '#fff',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
