import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, Button, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../../store/useStore';
import { getMedicines, addMedicine as addMedicineApi, deleteMedicine, scanPrescription } from '../../services/medicineApi';
import * as ImagePicker from 'expo-image-picker';

const CaregiverMedicinesScreen = () => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = currentCircle?.id;
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: 'Daily',
    scheduled_times: '',
    stock_quantity: '',
    refill_alert_threshold: ''
  });
  const [isScanning, setIsScanning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchMedicinesList();
    }, [circleId])
  );

  const fetchMedicinesList = async () => {
    if (!circleId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getMedicines(circleId);
      setMedicines(data || []);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
      Alert.alert('Error', 'Failed to fetch medicines');
      setMedicines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!formData.name || !formData.dosage) {
      Alert.alert('Error', 'Name and dosage are required');
      return;
    }
    if (!circleId) {
      Alert.alert('Error', 'No circle selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledTimesArray = formData.scheduled_times
        ? formData.scheduled_times.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      const stock = parseInt(formData.stock_quantity, 10) || 30;
      const threshold = parseInt(formData.refill_alert_threshold, 10) || Math.max(5, Math.floor(stock * 0.2));

      await addMedicineApi(circleId, {
        name: formData.name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        scheduled_times: scheduledTimesArray,
        stock_quantity: stock,
        refill_alert_threshold: threshold,
      });

      setModalVisible(false);
      setFormData({ name: '', dosage: '', frequency: 'Daily', scheduled_times: '', stock_quantity: '', refill_alert_threshold: '' });
      Alert.alert('Success', 'Medicine added successfully');
      fetchMedicinesList();
    } catch (error) {
      console.error('Add medicine error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add medicine');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Medicine', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteMedicine(id);
            setMedicines(prev => prev.filter(m => m.id !== id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete medicine');
          }
        }
      }
    ]);
  };

  const handleScanPrescription = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant photo library access.');
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      setIsScanning(true);
      const res = await scanPrescription(pickerResult.assets[0].uri);
      
      if (res.parsedData && res.parsedData.length > 0) {
        // Populate form with the first found medicine for MVP
        const med = res.parsedData[0];
        setFormData({
          ...formData,
          name: med.name || '',
          dosage: med.dosage || '',
          frequency: med.frequency || 'Daily',
          scheduled_times: Array.isArray(med.scheduled_times) ? med.scheduled_times.join(', ') : '',
        });
        setModalVisible(true);
        if (res.parsedData.length > 1) {
          Alert.alert('Multiple Medicines Found', 'Auto-filled the first one. Please add others manually for now.');
        } else {
          Alert.alert('Success', 'Prescription details extracted.');
        }
      } else {
        Alert.alert('Not Found', 'Could not extract medicine details from the image.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to scan prescription.');
    } finally {
      setIsScanning(false);
    }
  };

  const renderItem = ({ item }) => {
    let instructions = {};
    try {
      instructions = typeof item.instructions === 'string' ? JSON.parse(item.instructions) : (item.instructions || {});
    } catch (e) {}

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.name}</Text>
        <Text>Dosage: {item.dosage}</Text>
        <Text>Frequency: {instructions.frequency || 'Daily'}</Text>
        <Text>Times: {instructions.scheduled_times?.join(', ') || item.scheduled_time || 'Not set'}</Text>
        <Text style={[
          styles.stockText, 
          (item.stock_quantity !== null && item.stock_quantity <= (item.refill_alert_threshold || 5)) ? styles.lowStock : null
        ]}>
          Stock: {item.stock_quantity ?? 'N/A'} {item.stock_quantity !== null && item.stock_quantity <= (item.refill_alert_threshold || 5) && '(Low)'}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
        <Button title="Add Medicine" onPress={() => setModalVisible(true)} color="#1A73E8" />
        <Button 
          title={isScanning ? "Scanning..." : "📷 Scan Prescription"} 
          onPress={handleScanPrescription} 
          color="#0EA5E9" 
          disabled={isScanning} 
        />
      </View>
      <FlatList
        data={medicines}
        keyExtractor={(item) => item.slot_id || item.id?.toString() || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No medicines added yet.</Text>}
      />
      
      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Add New Medicine</Text>
          <TextInput style={styles.input} placeholder="Name *" value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} />
          <TextInput style={styles.input} placeholder="Dosage (e.g. 500mg) *" value={formData.dosage} onChangeText={(text) => setFormData({ ...formData, dosage: text })} />
          <TextInput style={styles.input} placeholder="Frequency (Daily, As Needed, Specific Days)" value={formData.frequency} onChangeText={(text) => setFormData({ ...formData, frequency: text })} />
          <TextInput style={styles.input} placeholder="Scheduled Times (e.g. 08:00, 20:00)" value={formData.scheduled_times} onChangeText={(text) => setFormData({ ...formData, scheduled_times: text })} />
          <TextInput style={styles.input} placeholder="Stock Quantity" value={formData.stock_quantity} keyboardType="numeric" onChangeText={(text) => setFormData({ ...formData, stock_quantity: text })} />
          <TextInput style={styles.input} placeholder="Refill Alert Threshold" value={formData.refill_alert_threshold} keyboardType="numeric" onChangeText={(text) => setFormData({ ...formData, refill_alert_threshold: text })} />
          <View style={styles.modalButtons}>
            <Button title={isSubmitting ? "Saving..." : "Save Medicine"} onPress={handleAddMedicine} color="#1A73E8" disabled={isSubmitting} />
            <Button title="Cancel" onPress={() => setModalVisible(false)} color="red" disabled={isSubmitting} />
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
  stockText: { marginTop: 4, fontWeight: '500' },
  lowStock: { color: 'red', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#999' },
  modalContainer: { flex: 1, padding: 16, justifyContent: 'center' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }
});

export default CaregiverMedicinesScreen;
