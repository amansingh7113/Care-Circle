import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { supabase } from '../../services/supabase';
import { useStore } from '../../store/useStore';

const STATUS_TABS = ['Todo', 'In Progress', 'Completed'];

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
    if (current === 'Todo') return 'In Progress';
    if (current === 'In Progress') return 'Completed';
    return 'Todo';
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{task.title}</Text>
        <View style={[styles.priorityPill, { backgroundColor: getPriorityColor(task.priority) }]}>
          <Text style={styles.priorityText}>{task.priority || 'Low'}</Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>{task.description}</Text>
      
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => onStatusChange(task.id, getNextStatus(task.status))}
        accessibilityRole="button"
        accessibilityLabel={`Move task to ${getNextStatus(task.status)}`}
      >
        <Text style={styles.actionText}>Move to {getNextStatus(task.status)}</Text>
      </TouchableOpacity>
    </View>
  );
};

const TasksScreen = () => {
  const currentCircle = useStore((state) => state.currentCircle);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('Todo');

  useEffect(() => {
    if (!currentCircle?.id) return;

    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('circle_id', currentCircle.id);
      
      if (!error && data) {
        setTasks(data);
      }
    };

    fetchTasks();

    const subscription = supabase
      .channel('public:tasks')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `circle_id=eq.${currentCircle.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentCircle]);

  const handleStatusChange = async (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
  };

  const filteredTasks = tasks.filter(task => task.status === activeTab);

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
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TaskCard task={item} onStatusChange={handleStatusChange} />
        )}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks in {activeTab}</Text>}
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
