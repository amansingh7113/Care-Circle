import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { THEME } from '../../styles/theme';
import { createApiClient } from '../../services/apiConfig';

const ManageCircleScreen = ({ navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiClient = createApiClient('/api/v1/circles');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    if (!currentCircle?.id) return;
    try {
      setLoading(true);
      const response = await apiClient.get(`/${currentCircle.id}`);
      if (response.data && response.data.members) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch circle members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (memberId) => {
    if (memberId === user.id) {
      Alert.alert('Error', 'You cannot remove yourself from here.');
      return;
    }
    
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the circle?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/${currentCircle.id}/members/${memberId}`);
              
              Alert.alert('Success', 'Member removed');
              fetchMembers();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to remove member');
            }
          }
        }
      ]
    );
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <View>
          <Text style={styles.memberName}>{item.name} {item.id === user.id ? '(You)' : ''}</Text>
          <Text style={styles.memberEmail}>{item.email || ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        </View>
      </View>
      
      {item.id !== user.id && (
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => handleRemoveMember(item.id)}
        >
          <Ionicons name="person-remove-outline" size={20} color={THEME.colors.danger} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Circle</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.circleName}>{currentCircle?.name}</Text>
        <Text style={styles.subtitle}>Circle Members</Text>

        {loading ? (
          <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={item => item.id.toString()}
            renderItem={renderMember}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10, backgroundColor: THEME.colors.white, ...THEME.shadows.soft },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { ...THEME.typography.header, fontSize: 20 },
  content: { flex: 1, padding: 20 },
  circleName: { fontSize: 24, fontWeight: '800', color: THEME.colors.textHeader, marginBottom: 8 },
  subtitle: { fontSize: 16, color: THEME.colors.textMuted, marginBottom: 20, fontWeight: '600' },
  listContainer: { paddingBottom: 20 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    ...THEME.shadows.soft,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${THEME.colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: THEME.colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textHeader,
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: `${THEME.colors.success}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: THEME.colors.success,
    fontSize: 12,
    fontWeight: 'bold',
  },
  removeButton: {
    padding: 8,
  },
});

export default ManageCircleScreen;
