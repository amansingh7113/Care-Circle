import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUserCircles, createCircle, joinCircle } from '../services/circleApi';
import { useStore } from '../store/useStore';

const CircleSelectionScreen = ({ navigation }) => {
  const [circles, setCircles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCircleName, setNewCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

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

  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) return Alert.alert('Error', 'Please enter a circle name');
    try {
      const data = await createCircle(newCircleName);
      Alert.alert('Success', 'Circle created successfully');
      setNewCircleName('');
      fetchCircles();
    } catch (error) {
      Alert.alert('Error', 'Failed to create circle');
    }
  };

  const handleJoinCircle = async () => {
    if (!inviteCode.trim()) return Alert.alert('Error', 'Please enter an invite code');
    try {
      const data = await joinCircle(inviteCode);
      Alert.alert('Success', 'Joined circle successfully');
      setInviteCode('');
      fetchCircles();
    } catch (error) {
      Alert.alert('Error', 'Failed to join circle');
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
      <Text style={styles.circleName}>{item.name}</Text>
      <Text style={styles.circleRole}>{item.role}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A73E8" />
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
          <View style={styles.actionBox}>
            <TextInput
              style={styles.input}
              placeholder="New Circle Name"
              value={newCircleName}
              onChangeText={setNewCircleName}
            />
            <TouchableOpacity style={styles.button} onPress={handleCreateCircle}>
              <Text style={styles.buttonText}>Create New Circle</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionBox}>
            <TextInput
              style={styles.input}
              placeholder="Invite Code"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
            <TouchableOpacity style={[styles.button, styles.joinButton]} onPress={handleJoinCircle}>
              <Text style={styles.buttonText}>Join Existing Circle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, marginTop: 40 },
  list: { paddingBottom: 20 },
  circleCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  circleName: { fontSize: 18, fontWeight: '600', color: '#1A73E8' },
  circleRole: { fontSize: 14, color: '#666', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#888' },
  actionsContainer: { marginTop: 'auto', borderTopWidth: 1, borderColor: '#eee', paddingTop: 20 },
  actionBox: { marginBottom: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 8 },
  button: { backgroundColor: '#1A73E8', padding: 14, borderRadius: 8, alignItems: 'center' },
  joinButton: { backgroundColor: '#34A853' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default CircleSelectionScreen;
