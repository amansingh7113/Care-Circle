import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Button, Modal, StyleSheet } from 'react-native';
import { useStore } from '../../store/useStore';

const CaregiverMedicinesScreen = () => {
  const { medicines, fetchMedicines, addMedicine } = useStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    instructions: '',
    scheduled_times: '',
    stock_quantity: '',
    refill_alert_threshold: ''
  });

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const handleAddMedicine = async () => {
    try {
      const response = await fetch('/api/v1/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_times: formData.scheduled_times.split(',').map(t => t.trim()),
          stock_quantity: parseInt(formData.stock_quantity, 10) || 0,
          refill_alert_threshold: parseInt(formData.refill_alert_threshold, 10) || 0
        })
      });
      
      if (response.ok) {
        const newMedicine = await response.json();
        addMedicine(newMedicine);
        setModalVisible(false);
        setFormData({ name: '', dosage: '', instructions: '', scheduled_times: '', stock_quantity: '', refill_alert_threshold: '' });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.name}</Text>
      <Text>Dosage: {item.dosage}</Text>
      <Text>Instructions: {item.instructions}</Text>
      <Text>Stock: {item.stock_quantity}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Button title="Add Medicine" onPress={() => setModalVisible(true)} color="#1A73E8" />
      <FlatList
        data={medicines}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Add New Medicine</Text>
          <TextInput style={styles.input} placeholder="Name" value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} />
          <TextInput style={styles.input} placeholder="Dosage" value={formData.dosage} onChangeText={(text) => setFormData({ ...formData, dosage: text })} />
          <TextInput style={styles.input} placeholder="Instructions" value={formData.instructions} onChangeText={(text) => setFormData({ ...formData, instructions: text })} />
          <TextInput style={styles.input} placeholder="Scheduled Times (comma separated)" value={formData.scheduled_times} onChangeText={(text) => setFormData({ ...formData, scheduled_times: text })} />
          <TextInput style={styles.input} placeholder="Stock Quantity" value={formData.stock_quantity} keyboardType="numeric" onChangeText={(text) => setFormData({ ...formData, stock_quantity: text })} />
          <TextInput style={styles.input} placeholder="Refill Alert Threshold" value={formData.refill_alert_threshold} keyboardType="numeric" onChangeText={(text) => setFormData({ ...formData, refill_alert_threshold: text })} />
          <View style={styles.modalButtons}>
            <Button title="Save Medicine" onPress={handleAddMedicine} color="#1A73E8" />
            <Button title="Cancel" onPress={() => setModalVisible(false)} color="red" />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  listContent: { paddingBottom: 24 },
  card: { backgroundColor: '#fff', padding: 16, marginVertical: 8, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }
});

export default CaregiverMedicinesScreen;
