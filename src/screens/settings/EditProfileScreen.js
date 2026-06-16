import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../styles/theme';
import { createApiClient } from '../../services/apiConfig';

const EditProfileScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const apiClient = createApiClient('/api/v1/users');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsFetching(true);
      const response = await apiClient.get('/profile');
      if (response.data && response.data.user) {
        setName(response.data.user.name || '');
        setPhone(response.data.user.phone || '');
        setEmail(response.data.user.email || 'N/A');
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      setIsLoading(true);
      
      await apiClient.put('/profile', { name, phone });

      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
      
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={email}
              editable={false}
            />
            <Text style={styles.hintText}>Email cannot be changed</Text>
          </View>

          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={THEME.colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10, backgroundColor: THEME.colors.white, ...THEME.shadows.soft },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { ...THEME.typography.header, fontSize: 20 },
  content: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { ...THEME.typography.label, marginBottom: 8, color: THEME.colors.textHeader },
  input: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.badge,
    padding: 16,
    fontSize: 16,
    backgroundColor: THEME.colors.white,
  },
  inputDisabled: {
    backgroundColor: THEME.colors.canvas,
    color: THEME.colors.textMuted,
  },
  hintText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
    padding: 16,
    borderRadius: THEME.borderRadius.badge,
    alignItems: 'center',
    marginTop: 20,
    ...THEME.shadows.soft,
  },
  saveButtonText: {
    color: THEME.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen;
