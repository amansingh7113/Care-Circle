import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTasks, updateTaskStatus } from '../services/taskApi';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import { THEME } from '../styles/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';

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
    if (!circleId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getTasks(circleId, activeTab);
      setTasks(data.tasks || data || []);
    } catch (error) {
      console.log('Failed to fetch tasks', error);
      // Fallback mock data for UI testing if API fails
      setTasks([
        { id: '1', title: 'Pick up Groceries', category: 'Groceries', dueDate: 'Tomorrow, 5 PM', assignee: 'Unassigned', status: 'pending' },
        { id: '2', title: 'Doctor Appointment', category: 'Medical', dueDate: 'Today, 2 PM', assignee: 'Alice', status: 'pending' },
        { id: '3', title: 'Buy Medicines', category: 'Medical', dueDate: 'Yesterday', assignee: 'You', status: 'completed' },
      ].filter(t => t.status === activeTab));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await updateTaskStatus(taskId, { status: newStatus });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Task marked as ${newStatus}`);
    } catch (error) {
      console.log('Failed to update task', error);
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
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.header}>Task Board</Text>
        </View>
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
        <View style={styles.container}>
          <SkeletonLoader />
          <SkeletonLoader />
        </View>
      ) : tasks.length === 0 ? (
        <EmptyState 
          iconName="checkmark-done-circle-outline" 
          titleText={`No ${activeTab} tasks`} 
          subtitleText={activeTab === 'pending' ? "You're all caught up! Enjoy your day." : "You haven't completed any tasks yet."}
        />
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
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 40 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8 },
  header: { ...THEME.typography.header, color: THEME.colors.primary },
  addBtn: { backgroundColor: THEME.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: THEME.colors.cardBg, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', marginBottom: 16, backgroundColor: THEME.colors.border, borderRadius: 8, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { backgroundColor: THEME.colors.primary },
  tabText: { ...THEME.typography.cardTitle, color: THEME.colors.textMuted },
  activeTabText: { color: THEME.colors.cardBg },
  list: { paddingBottom: 20 },
  card: { backgroundColor: THEME.colors.cardBg, padding: 16, borderRadius: THEME.borderRadius.card, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...THEME.shadows.soft, borderWidth: 1, borderColor: THEME.colors.border },
  cardInfo: { flex: 1 },
  taskTitle: { ...THEME.typography.cardTitle },
  taskCategory: { fontSize: 12, color: THEME.colors.primary, fontWeight: '600', backgroundColor: `${THEME.colors.primary}15`, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginBottom: 4 },
  taskDetails: { ...THEME.typography.body, color: THEME.colors.textMuted, marginTop: 2 },
  actions: { marginLeft: 10 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  completeBtn: { backgroundColor: THEME.colors.success },
  btnText: { color: THEME.colors.cardBg, fontSize: 14, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: THEME.colors.textMuted, fontSize: 16 }
});

export default TaskBoardScreen;
