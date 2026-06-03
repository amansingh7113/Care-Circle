import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMedicines, logAdministration } from '../services/medicineApi';
import { useStore } from '../store/useStore';

const MedicineDashboardScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = route.params?.circleId || currentCircle?.id;
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchMedicines();
    }, [circleId])
  );

  const fetchMedicines = async () => {
    setIsLoading(true);
    try {
      const data = await getMedicines(circleId);
      setMedicines(data.medicines || data || []);
    } catch (error) {
      console.log('Failed to fetch medicines', error);
      // Fallback mock data for UI testing if API fails
      setMedicines([
        { id: '1', name: 'Amoxicillin', dosage: '500mg', time: '08:00 AM', status: 'pending' },
        { id: '2', name: 'Lisinopril', dosage: '10mg', time: '12:00 PM', status: 'pending' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLog = async (id, status) => {
    // Optimistic update
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    try {
      await logAdministration(id, status);
      Alert.alert('Success', `Medicine marked as ${status}`);
    } catch (error) {
      console.log('Failed to log administration', error);
    }
  };

  const renderMedicine = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.medName}>{item.name}</Text>
        <Text style={styles.medDetails}>{item.dosage} at {item.time || (item.instructions?.scheduled_times ? item.instructions.scheduled_times.join(', ') : 'Scheduled')}</Text>
      </View>
      <View style={styles.actions}>
        {item.status === 'taken' || item.status === 'skipped' ? (
          <Text style={[styles.btnText, { color: item.status === 'taken' ? '#34A853' : '#EA4335', padding: 8 }]}>
            {item.status === 'taken' ? 'Taken' : 'Skipped'}
          </Text>
        ) : (
          <>
            <TouchableOpacity style={[styles.actionBtn, styles.takenBtn]} onPress={() => handleLog(item.id, 'taken')}>
              <Text style={styles.btnText}>Taken</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.skipBtn]} onPress={() => handleLog(item.id, 'skipped')}>
              <Text style={styles.btnText}>Skip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Medicine Tracker</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddMedicine', { circleId })}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      
      {medicines.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No medicines scheduled for today.</Text>
        </View>
      ) : (
        <FlatList
          data={medicines}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMedicine}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 40 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#1A73E8' },
  addBtn: { backgroundColor: '#1A73E8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: 'bold' },
  list: { paddingBottom: 20 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardInfo: { flex: 1 },
  medName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  medDetails: { fontSize: 14, color: '#666', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  takenBtn: { backgroundColor: '#34A853' },
  skipBtn: { backgroundColor: '#EA4335' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 }
});

export default MedicineDashboardScreen;
