import React, { useState, useCallback } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, 
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Users, Key } from 'lucide-react-native';
import { getUserCircles, createCircle, joinCircle } from '../services/circleApi';
import { useStore } from '../store/useStore';
import { THEME } from '../styles/theme';

const CircleSelectionScreen = ({ navigation }) => {
  const [circles, setCircles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [mode, setMode] = useState('join'); // 'join' or 'create'
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCircles();
    }, [])
  );

  const fetchCircles = async () => {
    setIsLoading(true);
    try {
      const data = await getUserCircles();
      setCircles(data.circles || data);
    } catch (error) {
      console.error('Failed to fetch circles', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      return Alert.alert('Error', `Please enter a ${mode === 'join' ? 'invite code' : 'circle name'}`);
    }
    
    setIsSubmitting(true);
    try {
      if (mode === 'join') {
        await joinCircle(inputValue);
      } else {
        await createCircle(inputValue);
      }
      
      // Success Haptic Feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setInputValue('');
      await fetchCircles();
      
      // We don't auto-navigate here unless there's only 1 circle, but let's just refresh the list 
      // so they can select it, or if it's the first circle, maybe they want to tap it.
      // Wait, the prompt says: "trigger a physical success haptic feedback... before navigating them directly to the main dashboard."
      // Let's fetch circles and navigate to the newly joined/created one.
      const updatedCirclesData = await getUserCircles();
      const updatedCircles = updatedCirclesData.circles || updatedCirclesData;
      
      if (updatedCircles && updatedCircles.length > 0) {
        // Find the latest one or just the first one. For simplicity, just pick the last one in the list (or first).
        const targetCircle = updatedCircles[updatedCircles.length - 1]; 
        useStore.getState().setCircle(targetCircle);
        navigation.navigate('Dashboard', { circleId: targetCircle.id, circleName: targetCircle.name });
      }
      
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to ${mode} circle`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCircleItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.circleThumbnail} 
      onPress={() => {
        useStore.getState().setCircle(item);
        navigation.navigate('Dashboard', { circleId: item.id, circleName: item.name });
      }}
    >
      <View style={styles.circleAvatar}>
        <Users size={28} color={THEME.colors.primary} />
      </View>
      <Text style={styles.circleThumbnailName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: THEME.colors.canvas }]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: THEME.colors.canvas }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topSection}>
        <Text style={styles.welcomeText}>WELCOME, USER</Text>
        {/* Placeholder for top vector graphic */}
        <View style={styles.graphicPlaceholder}>
          <Users size={80} color={THEME.colors.alert} />
        </View>
      </View>

      <View style={styles.midSection}>
        {circles.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={circles}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            renderItem={renderCircleItem}
            contentContainerStyle={styles.horizontalList}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You are not part of any circle yet.</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>
            {mode === 'join' ? 'JOIN YOUR CARE CIRCLE' : 'CREATE A CARE CIRCLE'}
          </Text>
          
          <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
            {mode === 'join' ? (
              <Key size={20} color={isFocused ? THEME.colors.primary : THEME.colors.textMuted} style={styles.inputIcon} />
            ) : (
              <Users size={20} color={isFocused ? THEME.colors.primary : THEME.colors.textMuted} style={styles.inputIcon} />
            )}
            <TextInput
              style={styles.input}
              placeholder={mode === 'join' ? "Enter Invite Code" : "New Circle Name"}
              placeholderTextColor={THEME.colors.textMuted}
              value={inputValue}
              onChangeText={setInputValue}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize={mode === 'join' ? 'characters' : 'words'}
            />
          </View>

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'join' ? 'Join Circle' : 'Create Circle'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => {
              setMode(mode === 'join' ? 'create' : 'join');
              setInputValue('');
            }}
          >
            <Text style={styles.secondaryButtonText}>
              {mode === 'join' ? 'Create a new Care Circle' : 'Join an existing Circle'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Graphic Anchor */}
        <View style={styles.bottomGraphic}>
           <View style={{ width: 200, height: 100, backgroundColor: `${THEME.colors.primary}20`, borderRadius: 50, marginTop: 40 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topSection: {
    backgroundColor: THEME.colors.deepNavy,
    height: '35%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 80,
    alignItems: 'center',
    zIndex: 2,
  },
  welcomeText: {
    color: THEME.colors.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 20,
  },
  graphicPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midSection: {
    height: 140,
    marginTop: -20, // Overlap slightly with top section
    zIndex: 3,
  },
  horizontalList: {
    paddingHorizontal: 20,
    paddingTop: 30,
    alignItems: 'center',
  },
  circleThumbnail: {
    alignItems: 'center',
    marginRight: 24,
    width: 80,
  },
  circleAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.canvas,
    borderWidth: 3,
    borderColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...THEME.shadows.soft
  },
  circleThumbnailName: {
    ...THEME.typography.label,
    color: THEME.colors.textHeader,
    textAlign: 'center',
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...THEME.typography.body, color: THEME.colors.textMuted },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  formCard: {
    width: '100%',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.soft,
    zIndex: 4,
  },
  cardTitle: {
    ...THEME.typography.cardTitle,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.badge,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: THEME.colors.canvas
  },
  inputFocused: {
    borderColor: THEME.colors.primary,
  },
  inputIcon: { marginRight: 12 },
  input: { 
    flex: 1,
    height: '100%',
    ...THEME.typography.body,
  },
  primaryButton: { 
    backgroundColor: THEME.colors.primary, 
    height: 56,
    borderRadius: THEME.borderRadius.badge, 
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  primaryButtonText: { color: THEME.colors.white, fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingVertical: 8, alignItems: 'center' },
  secondaryButtonText: { ...THEME.typography.body, color: THEME.colors.textMuted, fontWeight: '600' },
  bottomGraphic: {
    position: 'absolute',
    bottom: -20,
    zIndex: 1,
    alignItems: 'center',
  }
});

export default CircleSelectionScreen;
