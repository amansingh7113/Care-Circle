import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../styles/theme';
import { createPaymentOrder, verifyPayment } from '../../services/paymentApi';
import { useStore } from '../../store/useStore';
import * as Haptics from 'expo-haptics';

let RazorpayCheckout;
if (Platform.OS !== 'web') {
  RazorpayCheckout = require('react-native-razorpay').default;
}

const PremiumUpgradeScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const currentCircle = useStore(state => state.currentCircle);
  const setCircle = useStore(state => state.setCircle);

  const RAZORPAY_TEST_KEY_ID = 'rzp_test_YourTestKeyHere'; // Fallback for dev

  const features = [
    { icon: 'ban', title: 'Ad-Free Experience', description: 'Remove all banners and distractions from your care dashboard.' },
    { icon: 'people', title: 'Unlimited Caregivers', description: 'Invite as many family members or nurses to your circle as needed.' },
    { icon: 'analytics', title: 'Advanced Health Insights', description: 'Unlock AI-powered trend analysis for vitals and sleep logs.' },
    { icon: 'document-text', title: 'Unlimited PDF Reports', description: 'Export full health histories without the 1-month restriction.' }
  ];

  const handleUpgrade = async () => {
    try {
      setIsLoading(true);
      
      // 1. Create order on our backend
      const { order } = await createPaymentOrder(149); // ₹149

      // 2. Open Razorpay Checkout Modal
      const options = {
        description: 'CareCircle Family Plan',
        image: 'https://i.imgur.com/3g7nmJC.png',
        currency: order.currency,
        key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || RAZORPAY_TEST_KEY_ID,
        amount: order.amount,
        name: 'CareCircle',
        order_id: order.id,
        theme: { color: THEME.colors.primary }
      };

      RazorpayCheckout.open(options).then(async (data) => {
        // 3. Verify Payment Signature
        try {
          await verifyPayment({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature
          });
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Welcome to Premium! 👑', 'Your Care Circle is now on the Family Plan.');
          
          // Update global state optimistically so UI updates instantly
          setCircle({ ...currentCircle, is_premium: true });
          navigation.goBack();
        } catch (verifyErr) {
          Alert.alert('Verification Failed', 'Please contact support.');
        }
      }).catch((error) => {
        // User cancelled or failed
        setIsLoading(false);
        console.log('Payment error or cancellation:', error);
      });

    } catch (error) {
      console.error('Upgrade Error:', error);
      Alert.alert('Error', 'Failed to initiate upgrade. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>👑</Text>
          <Text style={styles.heroTitle}>CareCircle Family Plan</Text>
          <Text style={styles.heroSubtitle}>Upgrade your circle to unlock premium features and ensure the best care for your loved ones.</Text>
        </View>

        <View style={styles.pricingCard}>
          <Text style={styles.pricingPrice}>₹149<Text style={styles.pricingMonth}>/month</Text></Text>
          <Text style={styles.pricingDesc}>Billed monthly. Cancel anytime.</Text>
        </View>

        <View style={styles.featuresList}>
          {features.map((item, idx) => (
            <View key={idx} style={styles.featureItem}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={item.icon} size={24} color={THEME.colors.primary} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.upgradeBtn, isLoading && styles.upgradeBtnLoading]} 
          onPress={handleUpgrade}
          disabled={isLoading || currentCircle?.is_premium}
        >
          {isLoading ? (
            <ActivityIndicator color={THEME.colors.cardBg} />
          ) : currentCircle?.is_premium ? (
             <Text style={styles.upgradeBtnText}>Already Premium ✨</Text>
          ) : (
            <Text style={styles.upgradeBtnText}>Upgrade Now - ₹149/mo</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { padding: 20 },
  backButton: { padding: 8, marginLeft: -8 },
  scrollContent: { padding: 24, paddingBottom: 100 },
  heroSection: { alignItems: 'center', marginBottom: 32 },
  heroEmoji: { fontSize: 64, marginBottom: 16 },
  heroTitle: { ...THEME.typography.header, color: THEME.colors.textHeader, fontSize: 28, textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { ...THEME.typography.body, color: THEME.colors.textBody, textAlign: 'center', lineHeight: 22 },
  pricingCard: {
    backgroundColor: `${THEME.colors.primary}10`,
    padding: 24,
    borderRadius: THEME.borderRadius.card,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: `${THEME.colors.primary}30`
  },
  pricingPrice: { ...THEME.typography.header, fontSize: 36, color: THEME.colors.primary },
  pricingMonth: { fontSize: 16, color: THEME.colors.textMuted },
  pricingDesc: { ...THEME.typography.subtext, marginTop: 8 },
  featuresList: { gap: 24 },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start' },
  featureIconContainer: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${THEME.colors.primary}15`,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16
  },
  featureTextContainer: { flex: 1 },
  featureTitle: { ...THEME.typography.cardTitle, marginBottom: 4 },
  featureDescription: { ...THEME.typography.body, color: THEME.colors.textMuted, lineHeight: 20 },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 24,
    backgroundColor: THEME.colors.canvas,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border
  },
  upgradeBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 18,
    borderRadius: THEME.borderRadius.badge,
    alignItems: 'center',
    ...THEME.shadows.card
  },
  upgradeBtnLoading: { opacity: 0.7 },
  upgradeBtnText: { color: THEME.colors.white, fontSize: 18, fontWeight: '700' }
});

export default PremiumUpgradeScreen;
