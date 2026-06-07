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
      style={styles.circleCard} 
      onPress={() => {
        useStore.getState().setCircle(item);
        navigation.navigate('Dashboard', { circleId: item.id, circleName: item.name });
      }}
    >
      <View>
        <Text style={styles.circleName}>{item.name}</Text>
        <Text style={styles.circleRole}>{item.role}</Text>
      </View>
      <Users size={20} color={THEME.colors.primary} />
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
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.container}>
        <Text style={styles.header}>Your Care Circles</Text>
        
        {circles.length > 0 ? (
          <FlatList
            data={circles}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            renderItem={renderCircleItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You are not part of any circle yet.</Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>
              {mode === 'join' ? 'Join a Circle' : 'Create a Circle'}
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
            
            {/* Skip for now - Fallback for reviewers or users without invites if circles are empty */}
            {circles.length === 0 && (
              <TouchableOpacity 
                style={styles.skipButton}
                onPress={() => Alert.alert("Information", "You need to join or create a circle to access the dashboard.")}
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: THEME.colors.canvas, 
    padding: 20 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: { 
    ...THEME.typography.header,
    marginBottom: 20, 
    marginTop: 40 
  },
  list: { 
    paddingBottom: 20 
  },
  circleCard: { 
    backgroundColor: THEME.colors.cardBg, 
    padding: 20, 
    borderRadius: THEME.borderRadius.card, 
    marginBottom: 12, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...THEME.shadows.soft 
  },
  circleName: { 
    ...THEME.typography.cardTitle,
    color: THEME.colors.primary 
  },
  circleRole: { 
    ...THEME.typography.muted,
    marginTop: 4 
  },
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  emptyText: { 
    ...THEME.typography.body,
    color: THEME.colors.textMuted 
  },
  actionsContainer: { 
    marginTop: 'auto', 
    paddingTop: 10 
  },
  formCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 24,
    ...THEME.shadows.soft
  },
  cardTitle: {
    ...THEME.typography.cardTitle,
    marginBottom: 16,
    textAlign: 'center'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.badge,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: THEME.colors.canvas
  },
  inputFocused: {
    borderColor: THEME.colors.primary,
  },
  inputIcon: {
    marginRight: 12,
  },
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
  primaryButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  secondaryButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...THEME.typography.body,
    color: THEME.colors.secondary,
    fontWeight: '600'
  },
  skipButton: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4
  },
  skipButtonText: {
    ...THEME.typography.muted,
    textDecorationLine: 'underline'
  }
});

export default CircleSelectionScreen;
