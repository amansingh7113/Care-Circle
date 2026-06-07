import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCircleDetails } from '../services/circleApi';
import { THEME } from '../styles/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

const DashboardScreen = ({ route, navigation }) => {
  const { circleId, circleName = 'My Circle' } = route.params || {};
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (circleId) {
        fetchCircleData();
      } else {
        setIsLoading(false);
      }
    }, [circleId])
  );

  const fetchCircleData = async () => {
    setIsLoading(true);
    try {
      const data = await getCircleDetails(circleId);
      setMembers(data.members || []);
    } catch (error) {
      console.error('Failed to fetch circle details', error);
      Alert.alert('Error', 'Failed to load circle details');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{circleName} Dashboard</Text>

      <View style={styles.rosterContainer}>
        <Text style={styles.sectionTitle}>Active Members</Text>
        {isLoading ? (
          <View>
            <SkeletonLoader />
            <SkeletonLoader />
          </View>
        ) : members.length === 0 ? (
          <EmptyState 
            iconName="people-outline" 
            titleText="No Members Yet" 
            subtitleText="Invite family members to join your Care Circle."
          />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <Text style={styles.memberText}>• {item.name} ({item.role})</Text>}
            style={styles.rosterList}
          />
        )}
      </View>

      <View style={styles.shortcutsContainer}>
        <Text style={styles.sectionTitle}>Shortcuts</Text>
        <TouchableOpacity 
          style={styles.shortcutButton}
          onPress={() => navigation.navigate('MedicineTracker')}
        >
          <Text style={styles.buttonText}>💊 Medicine Logger</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shortcutButton, styles.taskButton]}
          onPress={() => navigation.navigate('TaskBoard')}
        >
          <Text style={styles.buttonText}>📋 Task Board</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shortcutButton, styles.settingsButton]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.buttonText}>⚙️ Settings & Legal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  header: { ...THEME.typography.header, color: THEME.colors.primary, marginBottom: 24, marginTop: 40 },
  rosterContainer: { backgroundColor: THEME.colors.cardBg, padding: 20, borderRadius: THEME.borderRadius.card, marginBottom: 24, ...THEME.shadows.soft, borderWidth: 1, borderColor: THEME.colors.border },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 12 },
  rosterList: { paddingLeft: 8 },
  memberText: { ...THEME.typography.body, marginBottom: 6 },
  shortcutsContainer: { flex: 1 },
  shortcutButton: { backgroundColor: THEME.colors.primary, padding: 18, borderRadius: THEME.borderRadius.card, alignItems: 'center', marginBottom: 16, ...THEME.shadows.soft },
  taskButton: { backgroundColor: THEME.colors.secondary },
  settingsButton: { backgroundColor: THEME.colors.textMuted },
  buttonText: { color: THEME.colors.cardBg, fontSize: 18, fontWeight: 'bold' }
});

export default DashboardScreen;
