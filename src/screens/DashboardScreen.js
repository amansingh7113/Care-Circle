import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCircleDetails } from '../services/circleApi';

const DashboardScreen = ({ route, navigation }) => {
  const { circleId, circleName = 'My Circle' } = route.params || {};
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (circleId) {
        fetchCircleData();
      } else {
        setIsLoading(false);
      }
    }, [circleId])
  );

  const fetchCircleData = async () => {
    setIsLoading(true);
    try {
      const data = await getCircleDetails(circleId);
      setMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch circle details', error);
      Alert.alert('Error', 'Failed to load circle details');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{circleName} Dashboard</Text>

      <View style={styles.rosterContainer}>
        <Text style={styles.sectionTitle}>Active Members</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#1A73E8" />
        ) : members.length === 0 ? (
          <Text style={styles.memberText}>No members found.</Text>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <Text style={styles.memberText}>• {item.name} ({item.role})</Text>}
            style={styles.rosterList}
          />
        )}
      </View>

      <View style={styles.shortcutsContainer}>
        <Text style={styles.sectionTitle}>Shortcuts</Text>
        <TouchableOpacity 
          style={styles.shortcutButton}
          onPress={() => navigation.navigate('MedicineTracker')}
        >
          <Text style={styles.buttonText}>💊 Medicine Logger</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shortcutButton, styles.taskButton]}
          onPress={() => navigation.navigate('TaskBoard')}
        >
          <Text style={styles.buttonText}>📋 Task Board</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#1A73E8', marginBottom: 24, marginTop: 40 },
  rosterContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  rosterList: { paddingLeft: 8 },
  memberText: { fontSize: 16, color: '#555', marginBottom: 6 },
  shortcutsContainer: { flex: 1 },
  shortcutButton: { backgroundColor: '#1A73E8', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  taskButton: { backgroundColor: '#FF6D00' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default DashboardScreen;
