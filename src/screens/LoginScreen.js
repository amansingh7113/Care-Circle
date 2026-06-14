import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
  const [authMode, setAuthMode] = useState('phone'); // 'phone', 'email-login', 'email-register'
  
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const loginWithEmail = useStore(state => state.loginWithEmail);
  const registerWithEmail = useStore(state => state.registerWithEmail);
  const emailAuthLoading = useStore(state => state.emailAuthLoading);

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

    Linking.getInitialURL().then(handleUrl);

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const validateEmail = (email) => {
    return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  };

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

  const handleEmailAuth = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      if (authMode === 'email-login') {
        await loginWithEmail(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await registerWithEmail(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || error.message || 'Authentication failed');
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    console.log('Initiating Google Login...');
    try {
      const redirectUri = 'carecircle://auth';
      console.log('Using static Redirect URI:', redirectUri);
      
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
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        console.log('WebBrowser Result:', result);
        
        if (result.type === 'success' && result.url) {
          const url = result.url;
          const paramsString = url.split('#')[1] || url.split('?')[1];
          if (paramsString) {
            const match = paramsString.match(/access_token=([^&]+)/);
            if (match && match[1]) {
              const accessToken = match[1];
              try {
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Welcome to CareCircle</Text>
        <Text style={styles.subtitle}>
          {authMode === 'phone' && 'Enter your phone number to get started'}
          {authMode === 'email-login' && 'Sign in with your email and password'}
          {authMode === 'email-register' && 'Create an account with email'}
        </Text>
        
        {authMode === 'phone' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Phone Number (e.g., +919876543210)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              placeholderTextColor="#999"
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

            <TouchableOpacity style={styles.switchModeButton} onPress={() => setAuthMode('email-login')}>
              <Text style={styles.switchModeText}>Continue with Email</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
            />

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleEmailAuth}
              disabled={emailAuthLoading}
            >
              {emailAuthLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{authMode === 'email-login' ? 'Sign In' : 'Sign Up'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.switchModeButton} 
              onPress={() => setAuthMode(authMode === 'email-login' ? 'email-register' : 'email-login')}
            >
              <Text style={styles.switchModeText}>
                {authMode === 'email-login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.switchModeButton} onPress={() => setAuthMode('phone')}>
              <Text style={styles.switchModeText}>Continue with Phone</Text>
            </TouchableOpacity>
          </>
        )}

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fdfdfd',
    color: '#333',
  },
  button: {
    backgroundColor: '#1A73E8', // Google Blue as per PRD constraints
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48, // 48dp constraint
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchModeButton: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 8,
  },
  switchModeText: {
    color: '#1A73E8',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: '#fff',
    height: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;

