import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCircleDetails } from '../services/circleApi';
import { THEME } from '../styles/theme';

const mockActivities = [
  { id: '1', user: 'Aman', action: 'completed a task', time: '10m ago', color: THEME.colors.success },
  { id: '2', user: 'Anshika', action: 'updated medication schedule', time: '2h ago', color: THEME.colors.primary },
  { id: '3', user: 'Rahul', action: 'logged blood pressure', time: '5h ago', color: THEME.colors.secondary },
];

const mockVitals = [
  { id: '1', label: 'Blood Pressure', value: '120/80', icon: '❤️', color: THEME.colors.alert },
  { id: '2', label: 'Mood', value: 'Good', icon: '😊', color: THEME.colors.primary },
  { id: '3', label: 'Hydration', value: '1.5L', icon: '💧', color: THEME.colors.secondary },
  { id: '4', label: 'Sleep', value: '7h 20m', icon: '🌙', color: THEME.colors.textMuted },
];

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
        // Add mock members if no circle ID for preview purposes
        setMembers([
          { id: 1, name: 'Aman', role: 'Admin' },
          { id: 2, name: 'Anshika', role: 'Member' },
          { id: 3, name: 'Rahul', role: 'Member' }
        ]);
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

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>{circleName}</Text>
        </View>

        {/* Module C: Horizontal Care Circle Avatar Stack */}
        <View style={styles.avatarSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarScroll}>
            {isLoading ? (
               <View style={styles.avatarLoader}><ActivityIndicator color={THEME.colors.primary} /></View>
            ) : (
              members.map((member) => (
                <View key={member.id} style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
                </View>
              ))
            )}
            <TouchableOpacity 
              style={[styles.avatarCircle, styles.addAvatarCircle]}
              onPress={() => Alert.alert('Invite', 'Navigate to Invite Code Screen')}
            >
              <Text style={styles.addAvatarText}>+</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Module B: Wellness Vitals Quick-Grid */}
        <View style={styles.vitalsSection}>
          <Text style={styles.sectionTitle}>Daily Vitals</Text>
          <View style={styles.vitalsGrid}>
            {mockVitals.map(vital => (
              <View key={vital.id} style={styles.vitalCard}>
                <View style={[styles.vitalIconContainer, { backgroundColor: `${vital.color}15` }]}>
                  <Text style={styles.vitalIcon}>{vital.icon}</Text>
                </View>
                <Text style={styles.vitalValue}>{vital.value}</Text>
                <Text style={styles.vitalLabel}>{vital.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Module A: Live Care Circle Activity Feed */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Activity Feed</Text>
          <View style={styles.timelineContainer}>
            {mockActivities.map((activity, index) => (
              <View key={activity.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: activity.color }]} />
                  {index !== mockActivities.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.activityCard}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUser}>{activity.user}</Text> {activity.action}
                    </Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.shortcutsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.shortcutsRow}>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: THEME.colors.primary }]}
              onPress={() => navigation.navigate('MedicineTracker')}
            >
              <Text style={styles.buttonText}>💊 Meds</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: THEME.colors.secondary }]}
              onPress={() => navigation.navigate('TaskBoard')}
            >
              <Text style={styles.buttonText}>📋 Tasks</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  container: { flex: 1, paddingHorizontal: 20 },
  headerContainer: { marginTop: 40, marginBottom: 20 },
  header: { ...THEME.typography.header, color: THEME.colors.primary },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 16, marginTop: 8 },
  
  // Avatar Stack Styles
  avatarSection: { marginBottom: 28 },
  avatarScroll: { alignItems: 'center', paddingVertical: 8 },
  avatarLoader: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  avatarCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: THEME.colors.secondary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
    borderWidth: 2, borderColor: THEME.colors.cardBg,
    ...THEME.shadows.soft
  },
  avatarText: { color: THEME.colors.cardBg, fontSize: 18, fontWeight: '700' },
  addAvatarCircle: { backgroundColor: THEME.colors.canvas, borderColor: THEME.colors.border, borderWidth: 2, borderStyle: 'dashed' },
  addAvatarText: { color: THEME.colors.textMuted, fontSize: 24, fontWeight: '400', marginTop: -2 },

  // Vitals Grid Styles
  vitalsSection: { marginBottom: 28 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  vitalCard: {
    width: '48%', backgroundColor: THEME.colors.cardBg,
    padding: 16, borderRadius: THEME.borderRadius.card,
    marginBottom: 16, ...THEME.shadows.soft,
    alignItems: 'flex-start'
  },
  vitalIconContainer: { padding: 8, borderRadius: 12, marginBottom: 12 },
  vitalIcon: { fontSize: 20 },
  vitalValue: { ...THEME.typography.header, fontSize: 22, marginBottom: 4 },
  vitalLabel: { ...THEME.typography.muted },

  // Activity Feed Styles
  activitySection: { marginBottom: 28 },
  timelineContainer: { paddingLeft: 8, marginTop: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 70 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 2, marginTop: 24 },
  timelineLine: { width: 2, flex: 1, backgroundColor: THEME.colors.border, position: 'absolute', top: 36, bottom: -24, zIndex: 1 },
  timelineContent: { flex: 1, paddingLeft: 16, paddingBottom: 16 },
  activityCard: {
    backgroundColor: THEME.colors.cardBg,
    padding: 16, borderRadius: THEME.borderRadius.card,
    ...THEME.shadows.soft,
    borderWidth: 1, borderColor: THEME.colors.canvas
  },
  activityText: { ...THEME.typography.body, marginBottom: 6 },
  activityUser: { fontWeight: '700', color: THEME.colors.textHeader },
  activityTime: { ...THEME.typography.muted, fontSize: 11, fontWeight: '500' },

  // Shortcuts Styles
  shortcutsContainer: { marginBottom: 20 },
  shortcutsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shortcutButton: {
    width: '48%', padding: 16, borderRadius: THEME.borderRadius.card,
    alignItems: 'center', ...THEME.shadows.soft
  },
  buttonText: { color: THEME.colors.cardBg, fontSize: 16, fontWeight: 'bold' }
});

export default DashboardScreen;
