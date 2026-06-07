import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
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
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.taskTitle}>{item.title}</Text>
          <View style={styles.taskMetaRow}>
            <View style={styles.assigneeAvatar}>
              <Text style={styles.assigneeInitial}>{item.assignee ? item.assignee.charAt(0) : 'U'}</Text>
            </View>
            <Text style={styles.taskDetails}>Due: {item.dueDate} - {item.assignee}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {activeTab === 'pending' ? (
             <TouchableOpacity style={styles.completionBadge} onPress={() => handleUpdateStatus(item.id, 'completed')}>
               <Ionicons name="checkmark" size={20} color={THEME.colors.primary} />
             </TouchableOpacity>
          ) : (
             <View style={[styles.completionBadge, { backgroundColor: THEME.colors.primary }]}>
               <Ionicons name="checkmark" size={20} color={THEME.colors.white} />
             </View>
          )}
        </View>
      </View>
    </View>
  );

  // Grouping logic for UI
  const groupedTasks = tasks.reduce((acc, task) => {
    let group = 'TODAY';
    if (task.dueDate && task.dueDate.toLowerCase().includes('tomorrow')) group = 'TOMORROW';
    else if (task.dueDate && task.dueDate.toLowerCase().includes('yesterday')) group = 'PREVIOUS';
    if (!acc[group]) acc[group] = [];
    acc[group].push(task);
    return acc;
  }, {});

  const renderGroupedTasks = () => {
    return Object.keys(groupedTasks).map(group => (
      <View key={group}>
        <Text style={styles.groupHeader}>{group}</Text>
        {groupedTasks[group].map(task => (
          <React.Fragment key={task.id}>
             {renderTask({ item: task })}
          </React.Fragment>
        ))}
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.white} />
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
        <View style={styles.contentArea}>
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
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {renderGroupedTasks()}
        </ScrollView>
      )}

      {/* Base Illustration Anchor */}
      <View style={styles.bottomIllustration}>
         <View style={styles.illustrationPlaceholder}>
            <Text style={{fontSize: 50}}>👩🏽‍⚕️🧑🏻‍⚕️👨🏾‍⚕️</Text>
         </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.deepNavy, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 40 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8 },
  header: { ...THEME.typography.header, color: THEME.colors.white, fontSize: 28 },
  addBtn: { backgroundColor: THEME.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: THEME.colors.white, fontWeight: '700' },
  tabContainer: { 
    flexDirection: 'row', 
    marginBottom: 24, 
    backgroundColor: '#E2E8F0', // Soft grey for unselected
    borderRadius: THEME.borderRadius.badge, 
    overflow: 'hidden',
    padding: 4
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: THEME.borderRadius.badge },
  activeTab: { backgroundColor: THEME.colors.primary },
  tabText: { ...THEME.typography.cardTitle, color: THEME.colors.textMuted, fontSize: 14 },
  activeTabText: { color: THEME.colors.white },
  listContainer: { paddingBottom: 150 },
  groupHeader: {
    color: THEME.colors.white,
    ...THEME.typography.label,
    fontSize: 12,
    marginBottom: 12,
    marginTop: 16,
    letterSpacing: 1.2
  },
  card: { 
    backgroundColor: THEME.colors.cardBg, 
    borderRadius: THEME.borderRadius.card, 
    marginBottom: 12, 
    ...THEME.shadows.soft 
  },
  cardContent: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardInfo: { flex: 1 },
  taskTitle: { ...THEME.typography.cardTitle, marginBottom: 8 },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center' },
  assigneeAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: `${THEME.colors.secondary}20`,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8
  },
  assigneeInitial: { fontSize: 10, fontWeight: '700', color: THEME.colors.secondary },
  taskDetails: { ...THEME.typography.body, color: THEME.colors.textMuted, fontSize: 12 },
  actions: { marginLeft: 16 },
  completionBadge: { 
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: THEME.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: THEME.colors.cardBg
  },
  contentArea: { flex: 1 },
  bottomIllustration: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: -1
  },
  illustrationPlaceholder: {
    backgroundColor: '#FAF6F0',
    width: '100%',
    height: 120,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default TaskBoardScreen;
