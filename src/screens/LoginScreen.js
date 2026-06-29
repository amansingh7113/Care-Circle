import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, LayoutAnimation, UIManager, Modal } from 'react-native';
import { sendOtp, exchangeSession } from '../services/authApi';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { changeLanguage } from '../i18n';
import { THEME } from '../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

WebBrowser.maybeCompleteAuthSession();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LoginScreen = ({ navigation }) => {
  const appLanguage = useStore(state => state.appLanguage);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);

  React.useEffect(() => {
    if (!appLanguage) {
      setLangModalVisible(true);
    }
  }, [appLanguage]);

  const handleSelectLanguage = (code) => {
    Haptics.selectionAsync();
    changeLanguage(code);
    setLangModalVisible(false);
  };

  const [authMode, setAuthMode] = useState('email-login'); // 'email-login', 'email-register'
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
      Alert.alert('Error', error.response?.data?.error || error.response?.data?.message || 'Failed to send verification code');
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
        setEmailModalVisible(false);
      } else {
        await registerWithEmail(email, password);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEmailModalVisible(false);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || error.message || 'Authentication failed');
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    console.log('Initiating Google Login...');
    try {
      const redirectUri = AuthSession.makeRedirectUri();
      console.log('Using dynamic Redirect URI:', redirectUri);
      
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
        <View style={styles.heroSection}>
          <Text style={styles.title}>Welcome to CareCircle</Text>
          <Text style={styles.subtitle}>Your all-in-one family caregiving companion</Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.authLabel}>Enter your phone number to start</Text>
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
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Send Verification Code"
          >
            <LinearGradient colors={THEME.gradients.primary} style={styles.button} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
            {loading ? (
              <ActivityIndicator color={THEME.colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send Verification Code</Text>
            )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity 
          style={styles.googleButton} 
          onPress={handleGoogleLogin}
          disabled={googleLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          {googleLoading ? (
            <ActivityIndicator color="#333" />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchModeButton} 
          onPress={() => { setAuthMode('email-login'); setEmailModalVisible(true); }}
          accessibilityRole="button"
          accessibilityLabel="Continue with Email"
        >
          <Text style={styles.switchModeText}>Continue with Email</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Elegant Email Auth Modal */}
      <Modal visible={emailModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.emailModalContent}>
            <Text style={styles.modalTitle}>{authMode === 'email-login' ? 'Sign In with Email' : 'Create Account'}</Text>
            <Text style={styles.modalBody}>
              {authMode === 'email-login' ? 'Enter your email and password to sign in' : 'Set up your email and password'}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Email Address"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
            />

            <TouchableOpacity 
              onPress={handleEmailAuth}
              disabled={emailAuthLoading}
              activeOpacity={0.8}
              style={{ width: '100%', marginBottom: 16 }}
            >
              <LinearGradient colors={THEME.gradients.primary} style={styles.button} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
              {emailAuthLoading ? (
                <ActivityIndicator color={THEME.colors.white} />
              ) : (
                <Text style={styles.buttonText}>{authMode === 'email-login' ? 'Sign In' : 'Sign Up'}</Text>
              )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalSwitchBtn} 
              onPress={() => setAuthMode(authMode === 'email-login' ? 'email-register' : 'email-login')}
            >
              <Text style={styles.switchModeText}>
                {authMode === 'email-login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setEmailModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Polished Language Selection Modal */}
      <Modal visible={langModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.langModalContent}>
            <Text style={styles.modalTitle}>Choose Language / भाषा चुनें</Text>
            <Text style={styles.modalBody}>
              Please select your preferred language. You can change this later in settings.
            </Text>
            <ScrollView style={{ maxHeight: 340, width: '100%', marginBottom: 16 }}>
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'हिन्दी (Hindi)' },
                { code: 'bn', label: 'বাংলা (Bengali)' },
                { code: 'ta', label: 'தமிழ் (Tamil)' },
                { code: 'te', label: 'తెలుగు (Telugu)' },
                { code: 'mr', label: 'मराठी (Marathi)' },
                { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
                { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' }
              ].map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={styles.langCardBtn}
                  onPress={() => handleSelectLanguage(lang.code)}
                >
                  <Text style={styles.langOptionText}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: THEME.colors.canvas,
  },
  heroSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    ...THEME.typography.header,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    ...THEME.typography.body,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.medium,
  },
  authLabel: {
    ...THEME.typography.label,
    color: THEME.colors.textHeader,
    marginBottom: 12,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.button,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: THEME.colors.canvas,
    color: THEME.colors.textBody,
    fontFamily: 'Inter_500Medium',
  },
  button: {
    height: 56,
    borderRadius: THEME.borderRadius.button,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    ...THEME.shadows.medium,
  },
  buttonText: {
    color: THEME.colors.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    fontWeight: '600',
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 8,
  },
  switchModeText: {
    color: THEME.colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: THEME.colors.textMuted,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  googleButton: {
    backgroundColor: THEME.colors.cardBg,
    height: 56,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.button,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    ...THEME.shadows.medium,
  },
  googleButtonText: {
    color: THEME.colors.textHeader,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  emailModalContent: { backgroundColor: THEME.colors.cardBg, padding: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, alignItems: 'center' },
  langModalContent: { backgroundColor: THEME.colors.cardBg, padding: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, alignItems: 'center', maxHeight: '80%' },
  modalTitle: { ...THEME.typography.cardTitle, marginBottom: 8, textAlign: 'center' },
  modalBody: { ...THEME.typography.body, color: THEME.colors.textMuted, textAlign: 'center', marginBottom: 24 },
  modalInput: {
    height: 56,
    width: '100%',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.button,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: THEME.colors.canvas,
    color: THEME.colors.textBody,
    fontFamily: 'Inter_500Medium',
  },
  modalSwitchBtn: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalCloseBtn: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { color: THEME.colors.textMuted, fontFamily: 'Inter_700Bold', fontSize: 14 },
  langCardBtn: { 
    padding: 16, 
    width: '100%', 
    backgroundColor: THEME.colors.canvas, 
    borderRadius: 16, 
    marginBottom: 12, 
    alignItems: 'center', 
    minHeight: 56,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center'
  },
  langOptionText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: THEME.colors.primary, fontWeight: '700' }
});

export default LoginScreen;
