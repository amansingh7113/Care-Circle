import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { addMedicine } from '../services/medicineApi';
import useStore from '../store/useStore';

const AddMedicineScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = route.params?.circleId || currentCircle?.id;
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Daily');
  const [time, setTime] = useState('');

  const handleAdd = async () => {
    if (!name || !dosage || !time) {
      return Alert.alert('Error', 'Please fill all required fields');
    }

    try {
      await addMedicine(circleId, { name, dosage, frequency, scheduled_times: [time] });
      Alert.alert('Success', 'Medicine added successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to add medicine');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Add New Medicine</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Medicine Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Paracetamol" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Dosage</Text>
          <TextInput style={styles.input} value={dosage} onChangeText={setDosage} placeholder="e.g. 500mg" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Frequency</Text>
          <TextInput style={styles.input} value={frequency} onChangeText={setFrequency} placeholder="e.g. Daily" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Time</Text>
          <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="e.g. 08:00 AM" />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
          <Text style={styles.submitBtnText}>Add Medicine</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#1A73E8', marginBottom: 24, marginTop: 40 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 8, fontSize: 16 },
  submitBtn: { backgroundColor: '#1A73E8', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default AddMedicineScreen;
