import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getTasks, updateTaskStatus } from '../../services/taskApi';
import { useStore } from '../../store/useStore';

const STATUS_TABS = ['pending', 'completed'];

const STATUS_LABELS = {
  pending: 'Pending',
  completed: 'Completed',
};

const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high': return '#F44336';
    case 'medium': return '#FFC107';
    case 'low': return '#9E9E9E';
    default: return '#9E9E9E';
  }
};

const TaskCard = ({ task, onStatusChange }) => {
  const getNextStatus = (current) => {
    return current === 'pending' ? 'completed' : 'pending';
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{task.title}</Text>
        <View style={[styles.priorityPill, { backgroundColor: getPriorityColor(task.priority) }]}>
          <Text style={styles.priorityText}>{task.category || 'General'}</Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>{task.description}</Text>
      {task.due_date && <Text style={styles.dueDate}>Due: {task.due_date}</Text>}
      
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => onStatusChange(task.id, getNextStatus(task.status))}
        accessibilityRole="button"
        accessibilityLabel={`Move task to ${STATUS_LABELS[getNextStatus(task.status)]}`}
      >
        <Text style={styles.actionText}>Mark as {STATUS_LABELS[getNextStatus(task.status)]}</Text>
      </TouchableOpacity>
    </View>
  );
};

const TasksScreen = () => {
  const currentCircle = useStore((state) => state.currentCircle);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!currentCircle?.id) return;
    try {
      const data = await getTasks(currentCircle.id, activeTab);
      setTasks(Array.isArray(data) ? data : (data?.tasks || []));
    } catch (error) {
      console.log('Failed to fetch tasks', error);
      setTasks([]);
    }
  }, [currentCircle?.id, activeTab]);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks])
  );

  const handleStatusChange = async (taskId, newStatus) => {
    // Optimistic update: remove from current filtered list
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await updateTaskStatus(taskId, { status: newStatus });
    } catch (error) {
      console.log('Failed to update task status', error);
      // Refetch on failure to restore correct state
      fetchTasks();
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{STATUS_LABELS[tab]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TaskCard task={item} onStatusChange={handleStatusChange} />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No {STATUS_LABELS[activeTab].toLowerCase()} tasks</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#1A73E8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
  },
  priorityPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  cardDescription: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 16,
  },
  actionButton: {
    minHeight: 48,
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#1A73E8',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9E9E9E',
    marginTop: 32,
    fontSize: 16,
  }
});

export default TasksScreen;
