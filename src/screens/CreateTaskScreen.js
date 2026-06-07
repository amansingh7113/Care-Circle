import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { createTask } from '../services/taskApi';
import { useStore } from '../store/useStore';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../styles/theme';

const CreateTaskScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = route.params?.circleId || currentCircle?.id;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');

  const handleCreate = async () => {
    if (!title || !dueDate) {
      return Alert.alert('Error', 'Please provide a title and due date');
    }

    try {
      await createTask(circleId, { title, description, category, due_date: dueDate, assigned_to: assignee, status: 'pending' });
      Alert.alert('Success', 'Task created successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create task');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.header}>Create New Task</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Pick up medicines" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Additional details..." multiline />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Category</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Medical, Groceries" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Due Date</Text>
          <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="e.g. Today, 5 PM" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Assignee (Optional)</Text>
          <TextInput style={styles.input} value={assignee} onChangeText={setAssignee} placeholder="e.g. User ID or Name" />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleCreate}>
          <Text style={styles.submitBtnText}>Post Task</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 40 },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8 },
  header: { fontSize: 24, fontWeight: 'bold', color: THEME.colors.primary },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 16, color: '#333', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 8, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1A73E8', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default CreateTaskScreen;
