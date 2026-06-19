import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { createTask, updateTask } from '../services/taskApi';
import { useStore } from '../store/useStore';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../styles/theme';
import { createApiClient } from '../services/apiConfig';

const CreateTaskScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = route.params?.circleId || currentCircle?.id;
  const taskToEdit = route.params?.taskToEdit;
  const isEditing = !!taskToEdit;
  
  const [title, setTitle] = useState(taskToEdit?.title || '');
  const [description, setDescription] = useState(taskToEdit?.description || '');
  const [category, setCategory] = useState(taskToEdit?.category || '');
  const [dueDate, setDueDate] = useState(taskToEdit?.dueDate || taskToEdit?.due_date || '');
  
  // Store the UUID of the selected member
  const [assigneeId, setAssigneeId] = useState(taskToEdit?.assigned_to || '');

  const [members, setMembers] = useState([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!circleId) return;
      try {
        setIsFetchingMembers(true);
        const circleClient = createApiClient('/api/v1/circles');
        const response = await circleClient.get(`/${circleId}`);
        setMembers(response.data.members || []);
      } catch (err) {
        console.error('Failed to fetch circle members', err);
      } finally {
        setIsFetchingMembers(false);
      }
    };
    fetchMembers();
  }, [circleId]);

  const handleSave = async () => {
    if (!title || !dueDate) {
      return Alert.alert('Error', 'Please provide a title and due date');
    }

    try {
      const payload = { 
        title, 
        description, 
        category: category || 'General', 
        due_date: dueDate, 
        assigned_to: assigneeId || null, 
        status: taskToEdit?.status || 'pending' 
      };
      
      if (isEditing) {
        await updateTask(taskToEdit.id, payload);
        Alert.alert('Success', 'Task updated successfully');
      } else {
        await createTask(circleId, payload);
        Alert.alert('Success', 'Task created successfully');
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', isEditing ? 'Failed to update task' : 'Failed to create task');
    }
  };

  const renderAssigneeSelector = () => {
    if (isFetchingMembers) {
      return <ActivityIndicator size="small" color={THEME.colors.primary} style={{ alignSelf: 'flex-start' }} />;
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberSelectorContainer}>
        <TouchableOpacity
          style={[styles.memberChip, !assigneeId && styles.memberChipSelected]}
          onPress={() => setAssigneeId('')}
        >
          <Text style={[styles.memberChipText, !assigneeId && styles.memberChipTextSelected]}>Unassigned</Text>
        </TouchableOpacity>
        {members.map(member => {
          const isSelected = assigneeId === member.id;
          return (
            <TouchableOpacity
              key={member.id}
              style={[styles.memberChip, isSelected && styles.memberChipSelected]}
              onPress={() => setAssigneeId(member.id)}
            >
              <Text style={[styles.memberChipText, isSelected && styles.memberChipTextSelected]}>
                {member.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
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
          <Text style={styles.header}>{isEditing ? 'Edit Task' : 'Create New Task'}</Text>
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
          <Text style={styles.label}>Assignee</Text>
          {renderAssigneeSelector()}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitBtnText}>{isEditing ? 'Save Changes' : 'Post Task'}</Text>
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
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  memberSelectorContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 8,
  },
  memberChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E0',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberChipSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  memberChipText: {
    color: '#4A5568',
    fontWeight: '600',
    fontSize: 14,
  },
  memberChipTextSelected: {
    color: '#FFF',
  },
});

export default CreateTaskScreen;
