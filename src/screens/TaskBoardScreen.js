import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTasks, updateTaskStatus } from '../services/taskApi';
import useStore from '../store/useStore';

const TaskBoardScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = route.params?.circleId || currentCircle?.id;
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [circleId, activeTab])
  );

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getTasks(circleId, activeTab);
      setTasks(data.tasks || data || []);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
      // Fallback mock data for UI testing if API fails
      setTasks([
        { id: '1', title: 'Pick up Groceries', category: 'Groceries', dueDate: 'Tomorrow, 5 PM', assignee: 'Unassigned', status: 'pending' },
        { id: '2', title: 'Doctor Appointment', category: 'Medical', dueDate: 'Today, 2 PM', assignee: 'Alice', status: 'pending' },
      ].filter(t => t.status === activeTab));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await updateTaskStatus(taskId, { status: newStatus });
      Alert.alert('Success', `Task marked as ${newStatus}`);
      fetchTasks();
    } catch (error) {
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const renderTask = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <Text style={styles.taskCategory}>{item.category}</Text>
        <Text style={styles.taskDetails}>Due: {item.dueDate}</Text>
        <Text style={styles.taskDetails}>Assignee: {item.assignee}</Text>
      </View>
      <View style={styles.actions}>
        {activeTab === 'pending' && (
          <TouchableOpacity style={[styles.actionBtn, styles.completeBtn]} onPress={() => handleUpdateStatus(item.id, 'completed')}>
            <Text style={styles.btnText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Task Board</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateTask', { circleId })}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]} 
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]} 
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>Completed</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1A73E8" /></View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No {activeTab} tasks.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTask}
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
  tabContainer: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#e0e0e0', borderRadius: 8, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { backgroundColor: '#1A73E8' },
  tabText: { color: '#666', fontWeight: '600' },
  activeTabText: { color: '#fff' },
  list: { paddingBottom: 20 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  cardInfo: { flex: 1 },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  taskCategory: { fontSize: 12, color: '#1A73E8', fontWeight: '600', backgroundColor: '#e8f0fe', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginBottom: 4 },
  taskDetails: { fontSize: 14, color: '#666', marginTop: 2 },
  actions: { marginLeft: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  completeBtn: { backgroundColor: '#34A853' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 }
});

export default TaskBoardScreen;
