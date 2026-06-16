import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Bell, AlertTriangle, CheckCircle, Package, Calendar } from 'lucide-react-native';
import { getNotifications, markAsRead, markAllAsRead } from '../services/notificationApi';
import { useStore } from '../store/useStore';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { THEME } from '../styles/theme';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const setUnreadCount = useStore(state => state.setUnreadCount);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, unread_count } = await getNotifications();
      setNotifications(data || []);
      setUnreadCount(unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
        setNotifications(prev => prev.map(n => 
          n.id === notification.id ? { ...n, is_read: true } : n
        ));
        setUnreadCount(useStore.getState().unreadNotificationCount - 1);
      } catch (error) {
        console.error('Failed to mark read', error);
      }
    }

    // Navigation logic based on type
    if (notification.type === 'MISSED_DOSE_ALERT') {
      navigation.navigate('MedicineTracker');
    } else if (notification.type === 'TASK_ASSIGNED') {
      navigation.navigate('TaskBoard');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'MISSED_DOSE_ALERT': return <AlertTriangle size={24} color={THEME.colors.alert} />;
      case 'REFILL_ALERT': return <Package size={24} color={THEME.colors.warning} />;
      case 'TASK_ASSIGNED': return <Calendar size={24} color={THEME.colors.primary} />;
      default: return <Bell size={24} color={THEME.colors.primary} />;
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {getIcon(item.type)}
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <CheckCircle size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonLoader count={5} variant="list-item" />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState 
          icon={Bell}
          title="No Notifications"
          message="You're all caught up! We'll notify you when there's an update."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: { padding: 4 },
  headerTitle: { ...THEME.typography.h2, color: '#fff' },
  loadingContainer: { padding: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardBg,
    padding: 16,
    borderRadius: THEME.borderRadius.card,
    marginBottom: 12,
    ...THEME.shadows.card,
    alignItems: 'center',
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contentContainer: { flex: 1 },
  title: { ...THEME.typography.cardTitle, fontSize: 16, marginBottom: 4 },
  body: { ...THEME.typography.body, marginBottom: 8, lineHeight: 20 },
  time: { ...THEME.typography.muted, fontSize: 12 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.primary,
    marginLeft: 12,
  },
});

export default NotificationsScreen;
