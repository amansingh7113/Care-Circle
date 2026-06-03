import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../../store/useStore';

const PatientDashboardScreen = () => {
  const { pendingMedicines, fetchPendingMedicines, updateMedicineLog } = useStore();

  useEffect(() => {
    fetchPendingMedicines();
  }, [fetchPendingMedicines]);

  const handleMarkTaken = async (logId) => {
    try {
      const response = await fetch(`/api/v1/medicines/logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Taken' })
      });
      
      if (response.ok) {
        updateMedicineLog(logId, 'Taken');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSkip = async (logId) => {
    try {
      const response = await fetch(`/api/v1/medicines/logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Skipped' })
      });
      
      if (response.ok) {
        updateMedicineLog(logId, 'Skipped');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.medicine?.name}</Text>
      <Text style={styles.details}>Time: {item.scheduled_time}</Text>
      <Text style={styles.details}>Dosage: {item.medicine?.dosage}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.takenButton]} onPress={() => handleMarkTaken(item.id)}>
          <Text style={styles.buttonText}>Mark Taken</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.skipButton]} onPress={() => handleSkip(item.id)}>
          <Text style={styles.buttonText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingMedicines}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  listContent: { padding: 16 },
  card: { backgroundColor: '#1E1E1E', padding: 20, marginVertical: 10, borderRadius: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  details: { fontSize: 18, color: '#E0E0E0', marginBottom: 16 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginHorizontal: 6 },
  takenButton: { backgroundColor: '#1A73E8' },
  skipButton: { backgroundColor: '#B00020' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});

export default PatientDashboardScreen;
