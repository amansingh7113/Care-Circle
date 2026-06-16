import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Send, User, Calendar, Tag, CheckCircle } from 'lucide-react-native';
import { THEME } from '../../styles/theme';
import SkeletonLoader from '../../components/SkeletonLoader';
import EmptyState from '../../components/EmptyState';
// Mock API imports since they might not exist yet, or we can use the ones specified by the user
import { getTaskComments, addTaskComment, updateTaskStatus } from '../../services/taskApi';
import { useStore } from '../../store/useStore';

const TaskDetailScreen = ({ route, navigation }) => {
  const { task } = route.params;
  const user = useStore(state => state.user);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [taskStatus, setTaskStatus] = useState(task.status || 'pending');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchComments = async () => {
    try {
      const data = await getTaskComments(task.id);
      setComments(data || []);
    } catch (error) {
      console.log('Failed to fetch comments', error);
      // fallback mock data if API fails
      setComments([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [task.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchComments();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    const commentText = newComment.trim();
    setNewComment('');
    
    // Optimistic update
    const tempComment = {
      id: Math.random().toString(),
      task_id: task.id,
      user_id: user?.id,
      text: commentText,
      created_at: new Date().toISOString(),
      user: { name: user?.full_name || 'Me' }
    };
    setComments(prev => [...prev, tempComment]);
    
    try {
      await addTaskComment(task.id, { text: commentText, user_id: user?.id });
      // Refresh to get actual data
      fetchComments();
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
      setComments(prev => prev.filter(c => c.id !== tempComment.id)); // revert
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (taskStatus === newStatus) return;
    setIsUpdatingStatus(true);
    setTaskStatus(newStatus); // Optimistic update
    try {
      await updateTaskStatus(task.id, { status: newStatus });
    } catch (error) {
      setTaskStatus(task.status); // Revert
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const renderComment = ({ item }) => {
    const isMe = item.user_id === user?.id;
    const name = item.user?.name || item.user?.full_name || 'User';
    const initial = name.charAt(0).toUpperCase();
    
    return (
      <View style={[styles.commentContainer, isMe && styles.myCommentContainer]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        <View style={[styles.commentBubble, isMe && styles.myCommentBubble]}>
          <Text style={[styles.commentName, isMe && styles.myCommentName]}>{isMe ? 'Me' : name}</Text>
          <Text style={[styles.commentText, isMe && styles.myCommentText]}>{item.text}</Text>
          <Text style={[styles.commentTime, isMe && styles.myCommentTime]}>
            {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>
      </View>
    );
  };

  const getStatusColor = (status) => {
    return status === 'completed' ? THEME.colors.primary : THEME.colors.alert || '#E53935';
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <View style={{width: 24}} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.taskInfoCard}>
          <View style={styles.titleRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(taskStatus)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(taskStatus) }]}>
                {taskStatus.toUpperCase()}
              </Text>
            </View>
          </View>
          
          {task.description && (
            <Text style={styles.taskDescription}>{task.description}</Text>
          )}
          
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Calendar size={16} color={THEME.colors.textMuted} />
              <Text style={styles.metaText}>{task.dueDate || 'No due date'}</Text>
            </View>
            <View style={styles.metaItem}>
              <User size={16} color={THEME.colors.textMuted} />
              <Text style={styles.metaText}>{task.assignee || 'Unassigned'}</Text>
            </View>
            {task.category && (
              <View style={styles.metaItem}>
                <Tag size={16} color={THEME.colors.textMuted} />
                <Text style={styles.metaText}>{task.category}</Text>
              </View>
            )}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.statusBtn, taskStatus === 'pending' && styles.activePendingBtn]}
              onPress={() => handleStatusChange('pending')}
              disabled={isUpdatingStatus}
            >
              <Text style={[styles.statusBtnText, taskStatus === 'pending' && styles.activeBtnText]}>Mark Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusBtn, taskStatus === 'completed' && styles.activeCompletedBtn]}
              onPress={() => handleStatusChange('completed')}
              disabled={isUpdatingStatus}
            >
              <CheckCircle size={16} color={taskStatus === 'completed' ? THEME.colors.white : THEME.colors.textMuted} style={{marginRight: 6}} />
              <Text style={[styles.statusBtnText, taskStatus === 'completed' && styles.activeBtnText]}>Completed</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <MessageCircle size={20} color={THEME.colors.textHeader} />
            <Text style={styles.commentsTitle}>Comments</Text>
          </View>
          
          {isLoading ? (
            <View style={{marginTop: 20}}>
              <SkeletonLoader />
              <SkeletonLoader />
            </View>
          ) : comments.length === 0 ? (
            <EmptyState 
              iconName="chatbubble-outline"
              titleText="No Comments"
              subtitleText="Be the first to add a comment."
            />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id.toString()}
              renderItem={renderComment}
              scrollEnabled={false}
              contentContainerStyle={styles.commentsList}
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor={THEME.colors.textMuted}
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]} 
          onPress={handleAddComment}
          disabled={!newComment.trim()}
          hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
        >
          <Send size={20} color={THEME.colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: THEME.colors.white, ...THEME.shadows.soft
  },
  backButton: { padding: 4 },
  headerTitle: { ...THEME.typography.header, fontSize: 18 },
  content: { flex: 1 },
  taskInfoCard: {
    backgroundColor: THEME.colors.white,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: THEME.borderRadius.card,
    ...THEME.shadows.medium
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  taskTitle: { ...THEME.typography.cardTitle, fontSize: 20, flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  taskDescription: { ...THEME.typography.body, color: THEME.colors.textBody, marginBottom: 16 },
  metaContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  metaText: { marginLeft: 6, fontSize: 13, color: THEME.colors.textMuted, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12 },
  statusBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: THEME.borderRadius.button,
    backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.border
  },
  statusBtnText: { fontWeight: '600', color: THEME.colors.textMuted },
  activePendingBtn: { backgroundColor: THEME.colors.alert || '#E53935', borderColor: THEME.colors.alert || '#E53935' },
  activeCompletedBtn: { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary },
  activeBtnText: { color: THEME.colors.white },
  divider: { height: 1, backgroundColor: THEME.colors.border, marginVertical: 24, marginHorizontal: 32 },
  commentsSection: { paddingHorizontal: 20, paddingBottom: 40 },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  commentsTitle: { ...THEME.typography.cardTitle, fontSize: 18, marginLeft: 8 },
  commentsList: { gap: 16 },
  commentContainer: { flexDirection: 'row', marginBottom: 16, maxWidth: '85%' },
  myCommentContainer: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: THEME.colors.white, fontWeight: 'bold', fontSize: 16 },
  commentBubble: { backgroundColor: THEME.colors.white, padding: 12, borderRadius: 16, borderTopLeftRadius: 4, ...THEME.shadows.soft },
  myCommentBubble: { backgroundColor: THEME.colors.primary, borderTopLeftRadius: 16, borderTopRightRadius: 4 },
  commentName: { fontSize: 12, fontWeight: 'bold', color: THEME.colors.textMuted, marginBottom: 4 },
  myCommentName: { color: 'rgba(255,255,255,0.8)' },
  commentText: { fontSize: 15, color: THEME.colors.textBody, marginBottom: 4 },
  myCommentText: { color: THEME.colors.white },
  commentTime: { fontSize: 10, color: THEME.colors.textMuted, alignSelf: 'flex-end' },
  myCommentTime: { color: 'rgba(255,255,255,0.6)' },
  inputContainer: { 
    flexDirection: 'row', alignItems: 'flex-end', padding: 16,
    backgroundColor: THEME.colors.white, borderTopWidth: 1, borderTopColor: THEME.colors.border
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: THEME.colors.surface,
    borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    marginRight: 12, fontSize: 15, color: THEME.colors.textBody
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2
  },
  sendButtonDisabled: { opacity: 0.5 }
});

export default TaskDetailScreen;
