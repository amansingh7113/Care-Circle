import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView, SafeAreaView, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTasks, updateTaskStatus, deleteTask } from '../services/taskApi';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import { THEME } from '../styles/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import AdBanner from '../components/AdBanner';

const TaskBoardScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const lastHeartbeat = useStore(state => state.lastHeartbeat);
  const circleId = route.params?.circleId || currentCircle?.id;
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const slideAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [circleId, activeTab])
  );

  useEffect(() => {
    if (lastHeartbeat) {
      fetchTasks();
    }
  }, [lastHeartbeat]);

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
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.timing(slideAnim, {
      toValue: tab === 'pending' ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await updateTaskStatus(taskId, { status: newStatus });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Task marked as ${newStatus}`);
    } catch (error) {
      console.log('Failed to update task', error);
      fetchTasks();
    }
  };

  const handleDeleteTask = (taskId) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await deleteTask(taskId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchTasks();
            } catch (error) {
              console.log('Failed to delete task', error);
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderTask = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('TaskDetail', { task: item })}
      onLongPress={() => handleDeleteTask(item.id)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${item.title}, due ${item.due_date || 'N/A'}`}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.taskTitle}>{item.title}</Text>
          <View style={styles.taskMetaRow}>
            <View style={styles.assigneeAvatar}>
              <Text style={styles.assigneeInitial}>{item.assignee?.name ? item.assignee.name.charAt(0).toUpperCase() : 'U'}</Text>
            </View>
            <Text style={styles.taskDetails}>Due: {item.due_date || 'N/A'} - {item.assignee?.name || 'Unassigned'}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('CreateTask', { circleId, taskToEdit: item })} 
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={`Edit task ${item.title}`}
          >
            <Ionicons name="pencil" size={20} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleDeleteTask(item.id)} 
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel={`Delete task ${item.title}`}
          >
            <Ionicons name="trash-outline" size={20} color={THEME.colors.alert} />
          </TouchableOpacity>
          {activeTab === 'pending' ? (
             <TouchableOpacity 
               style={styles.completionBadge} 
               onPress={() => handleUpdateStatus(item.id, 'completed')}
               accessibilityRole="button"
               accessibilityLabel={`Mark task ${item.title} as completed`}
             >
               <Ionicons name="checkmark" size={20} color={THEME.colors.primary} />
             </TouchableOpacity>
          ) : (
             <View style={[styles.completionBadge, { backgroundColor: THEME.colors.primary }]}>
               <Ionicons name="checkmark" size={20} color={THEME.colors.white} />
             </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const groupedTasks = tasks.reduce((acc, task) => {
    let group = 'TODAY';
    if (task.due_date && task.due_date.toLowerCase().includes('tomorrow')) group = 'TOMORROW';
    else if (task.due_date && task.due_date.toLowerCase().includes('yesterday')) group = 'PREVIOUS';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={THEME.colors.textHeader} />
          </TouchableOpacity>
          <Text style={styles.header}>Task Board</Text>
        </View>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => navigation.navigate('CreateTask', { circleId })}
          accessibilityRole="button"
          accessibilityLabel="Create new task"
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabContainer}>
        <Animated.View style={[styles.tabIndicator, {
          left: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '50%']
          })
        }]} />
        <TouchableOpacity 
          style={styles.tab} 
          onPress={() => switchTab('pending')}
          accessibilityRole="button"
          accessibilityLabel="Pending tasks tab"
          accessibilityState={{ selected: activeTab === 'pending' }}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.tab} 
          onPress={() => switchTab('completed')}
          accessibilityRole="button"
          accessibilityLabel="Completed tasks tab"
          accessibilityState={{ selected: activeTab === 'completed' }}
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

      <AdBanner />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 40 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8, marginRight: 8 },
  header: { ...THEME.typography.header, color: THEME.colors.textHeader, fontSize: 28 },
  addBtn: { backgroundColor: THEME.colors.primary, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', borderRadius: 20 },
  addBtnText: { color: THEME.colors.white, fontFamily: 'Inter_700Bold', fontWeight: '700' },
  tabContainer: { 
    flexDirection: 'row', 
    marginBottom: 24, 
    backgroundColor: THEME.colors.border, 
    borderRadius: THEME.borderRadius.badge, 
    overflow: 'hidden',
    padding: 4,
    position: 'relative',
    height: 56
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.badge - 2,
  },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tabText: { ...THEME.typography.cardTitle, color: THEME.colors.textMuted, fontSize: 14 },
  activeTabText: { color: THEME.colors.white },
  listContainer: { paddingBottom: 120 },
  groupHeader: {
    color: THEME.colors.textHeader,
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
    ...THEME.shadows.soft,
    borderWidth: 1,
    borderColor: THEME.colors.border
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
    backgroundColor: THEME.colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8
  },
  assigneeInitial: { fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: THEME.colors.primary },
  taskDetails: { ...THEME.typography.body, color: THEME.colors.textMuted, fontSize: 12 },
  actions: { marginLeft: 16, flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 8, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  completionBadge: { 
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: THEME.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: THEME.colors.cardBg
  },
  contentArea: { flex: 1 },
});

export default TaskBoardScreen;
