import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Pill } from 'lucide-react-native';
import { getCircleDetails } from '../services/circleApi';
import { getSleepLogs } from '../services/sleepApi';
import { getMedicines } from '../services/medicineApi';
import { getVitals } from '../services/vitalsApi';
import { THEME } from '../styles/theme';
import CircularProgressRing from '../components/CircularProgressRing';
import LogBloodPressureModal from './home/LogBloodPressureModal';
import { useStore } from '../store/useStore';

const mockActivities = [
  { id: '1', user: 'Aman', action: 'completed a task', time: '10m ago', color: THEME.colors.success },
  { id: '2', user: 'Anshika', action: 'updated medication schedule', time: '2h ago', color: THEME.colors.primary },
  { id: '3', user: 'Rahul', action: 'logged blood pressure', time: '5h ago', color: THEME.colors.secondary },
];

const mockVitals = [
  { id: '1', label: 'Blood Pressure', value: '120/80', icon: '❤️', color: THEME.colors.alert },
  { id: '2', label: 'Medication', value: 'In 30 Mins', icon: 'Pill', color: THEME.colors.primary, subLabel: 'Aspirin • 81mg', upcoming: true },
  { id: '3', label: 'Hydration', value: '1.5L', icon: '💧', color: '#3BA0E3' }, // custom blue
  { id: '4', label: 'Sleep', value: '7h 20m', icon: '🌙', color: '#FCD34D' }, // custom yellow
];

const DashboardScreen = ({ route, navigation }) => {
  const { circleId, circleName = 'My Circle' } = route.params || {};
  const [members, setMembers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bpModalVisible, setBpModalVisible] = useState(false);
  const { bloodPressureLogs, sleepLogs, setBloodPressureLogs, setSleepLogs } = useStore();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [pulseAnim]);

  const latestBp = bloodPressureLogs && bloodPressureLogs.length > 0 ? `${bloodPressureLogs[0].systolic}/${bloodPressureLogs[0].diastolic}` : '--/--';
  
  const formatDuration = (minutes) => {
    if (!minutes) return '--h --m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };
  const latestSleep = sleepLogs && sleepLogs.length > 0 ? formatDuration(sleepLogs[0].duration_minutes) : '--h --m';

  useFocusEffect(
    useCallback(() => {
      if (circleId) {
        fetchCircleData();
      } else {
        setIsLoading(false);
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
      // Run API calls in parallel for better performance
      const [circleData, sleepData, vitalsData, medsData] = await Promise.all([
        getCircleDetails(circleId).catch(() => ({ members: [] })),
        getSleepLogs(circleId).catch(() => []),
        getVitals(circleId).catch(() => []),
        getMedicines(circleId).catch(() => ({ medicines: [] }))
      ]);
      
      setMembers(circleData?.members || []);
      setSleepLogs(Array.isArray(sleepData) ? sleepData : []);
      setBloodPressureLogs(Array.isArray(vitalsData) ? vitalsData : []);
      setMedicines(medsData?.medicines || (Array.isArray(medsData) ? medsData : []));
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      Alert.alert('Error', 'Failed to load some dashboard details');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Module: Daily Progress Hero Card */}
        <View style={styles.progressSection}>
          <View style={styles.progressCard}>
            <CircularProgressRing progress={75} size={110} strokeWidth={14} color={THEME.colors.primary} />
            <View style={styles.progressInfo}>
              <Text style={styles.progressValue}>75%</Text>
              <Text style={styles.progressLabel}>TASKS COMPLETED</Text>
            </View>
          </View>
        </View>

        {/* Module B: Wellness Vitals Quick-Grid */}
        <View style={styles.vitalsSection}>
          <Text style={styles.sectionTitle}>Vitals</Text>
          <View style={styles.vitalsGrid}>
            {mockVitals.map(vital => {
              const isBP = vital.label === 'Blood Pressure';
              const isSleep = vital.label === 'Sleep';
              const isMedication = vital.label === 'Medication';
              
              let displayValue = vital.value;
              let currentSubLabel = vital.subLabel;
              let currentUpcoming = vital.upcoming;

              if (isBP && bloodPressureLogs?.length > 0) displayValue = latestBp;
              if (isSleep && sleepLogs?.length > 0) displayValue = latestSleep;
              if (isMedication) {
                const pendingMeds = (medicines || []).filter(m => m.status !== 'taken');
                const nextMed = pendingMeds.length > 0 ? pendingMeds[0] : null;
                currentUpcoming = !!nextMed;
                displayValue = nextMed 
                  ? (nextMed.time || (nextMed.instructions?.scheduled_times ? nextMed.instructions.scheduled_times[0] : 'Upcoming'))
                  : 'All Taken';
                currentSubLabel = nextMed 
                  ? `${nextMed.name}${nextMed.dosage ? ` • ${nextMed.dosage}` : ''}`
                  : 'No pending meds';
              }

              return (
                <TouchableOpacity 
                  key={vital.id} 
                  style={styles.vitalCard}
                  onPress={() => {
                    if (isBP) setBpModalVisible(true);
                    if (isMedication) navigation.navigate('MedicineTracker');
                    if (isSleep) {
                      // In future iterations we can show a detailed sleep graph modal here
                    }
                  }}
                  activeOpacity={(isBP || isSleep || isMedication) ? 0.7 : 1}
                >
                  <View style={styles.vitalHeaderRow}>
                    {isMedication ? (
                      <Animated.View style={{ opacity: currentUpcoming ? pulseAnim : 1, marginRight: 8 }}>
                         <Pill size={20} color={vital.color} />
                      </Animated.View>
                    ) : (
                      <Text style={styles.vitalIcon}>{vital.icon}</Text>
                    )}
                    <Text style={styles.vitalValue}>{displayValue}</Text>
                  </View>
                  {isMedication && currentSubLabel ? (
                    <Text style={styles.vitalSubLabel} numberOfLines={1}>{currentSubLabel}</Text>
                  ) : (
                    <View style={[styles.vitalBarContainer, { backgroundColor: `${vital.color}20` }]}>
                      <View style={[styles.vitalBarFill, { backgroundColor: vital.color, width: '70%' }]} />
                    </View>
                  )}
                  <Text style={styles.vitalLabel}>{vital.label.toUpperCase()}</Text>
                  {isBP && <Text style={{fontSize: 10, color: THEME.colors.primary, marginTop: 4, fontWeight: 'bold'}}>+ LOG</Text>}
                  {isSleep && <Text style={{fontSize: 10, color: THEME.colors.textMuted, marginTop: 4, fontWeight: '600'}}>AUTO</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Module A: Live Care Circle Activity Feed Timeline */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Activity Feed</Text>
          <View style={styles.timelineContainer}>
            {mockActivities.map((activity, index) => (
              <View key={activity.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIconBadge, { backgroundColor: `${activity.color}20` }]}>
                     {/* Replace with actual icons based on action type */}
                     {activity.action.includes('medication') || activity.action.includes('Meds') ? (
                       <Text style={{fontSize: 12}}>💊</Text>
                     ) : activity.action.includes('blood pressure') || activity.action.includes('Vitals') ? (
                       <Text style={{fontSize: 12}}>❤️</Text>
                     ) : (
                       <Text style={{fontSize: 12}}>📋</Text>
                     )}
                  </View>
                  {index !== mockActivities.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.activityText}>
                    <Text style={styles.activityUser}>{activity.user}</Text> {activity.action}
                  </Text>
                  <Text style={styles.activityTime}>{activity.time.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions (Keeping for functionality but updating style) */}
        <View style={styles.shortcutsContainer}>
          <View style={styles.shortcutsRow}>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: THEME.colors.primary }]}
              onPress={() => navigation.navigate('MedicineTracker')}
            >
              <Text style={styles.buttonText}>Medicine Tracker</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: THEME.colors.deepNavy }]}
              onPress={() => navigation.navigate('TaskBoard')}
            >
              <Text style={styles.buttonText}>Task Board</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={{height: 100}} />
      </ScrollView>

      {/* Blurred Header */}
      <BlurView intensity={90} tint="light" style={styles.blurHeader}>
        <SafeAreaView>
          <View style={styles.headerContainer}>
            <Text style={styles.header}>{circleName}</Text>
            <TouchableOpacity style={styles.settingsIcon}>
               {/* Gear icon placeholder */}
               <Text style={{fontSize: 24, color: THEME.colors.primary}}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </BlurView>

      <LogBloodPressureModal visible={bpModalVisible} onClose={() => setBpModalVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 120, paddingBottom: 40 },
  blurHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 20 },
  headerContainer: { marginTop: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { ...THEME.typography.header, color: THEME.colors.primary },
  settingsIcon: { padding: 4 },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 16, marginTop: 8 },
  
  // Progress Ring Styles
  progressSection: { marginBottom: 24 },
  progressCard: {
    backgroundColor: THEME.colors.cardBg,
    padding: 24, borderRadius: THEME.borderRadius.card,
    flexDirection: 'row', alignItems: 'center',
    ...THEME.shadows.soft,
    borderWidth: 1, borderColor: THEME.colors.border
  },
  progressInfo: { marginLeft: 24, flex: 1 },
  progressValue: { ...THEME.typography.header, fontSize: 32, marginBottom: 4 },
  progressLabel: { ...THEME.typography.label, color: THEME.colors.textBody },
  
  // Vitals Grid Styles
  vitalsSection: { marginBottom: 28 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  vitalCard: {
    width: '48%', backgroundColor: THEME.colors.cardBg,
    padding: 16, borderRadius: THEME.borderRadius.card,
    marginBottom: 16, ...THEME.shadows.soft,
    borderWidth: 1, borderColor: THEME.colors.border,
    justifyContent: 'space-between'
  },
  vitalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  vitalIcon: { fontSize: 20, marginRight: 8 },
  vitalValue: { ...THEME.typography.cardTitle, fontSize: 20 },
  vitalBarContainer: { height: 6, borderRadius: 3, width: '100%', marginBottom: 10 },
  vitalBarFill: { height: '100%', borderRadius: 3 },
  vitalLabel: { ...THEME.typography.label, fontSize: 10 },
  vitalSubLabel: { ...THEME.typography.label, color: THEME.colors.textMuted, marginBottom: 10, fontSize: 12 },

  // Activity Feed Styles
  activitySection: { marginBottom: 28 },
  timelineContainer: { paddingLeft: 4, marginTop: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineIconBadge: { width: 32, height: 32, borderRadius: 16, zIndex: 2, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: `${THEME.colors.border}80`, position: 'absolute', top: 36, bottom: -4, zIndex: 1 },
  timelineContent: { flex: 1, paddingLeft: 16, paddingBottom: 24, paddingTop: 8 },
  activityText: { ...THEME.typography.body, marginBottom: 6 },
  activityUser: { fontWeight: '700', color: THEME.colors.textHeader },
  activityTime: { ...THEME.typography.label, fontSize: 10, color: THEME.colors.textMuted },

  // Shortcuts Styles
  shortcutsContainer: { marginBottom: 20 },
  shortcutsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shortcutButton: {
    width: '48%', padding: 16, borderRadius: THEME.borderRadius.badge,
    alignItems: 'center', ...THEME.shadows.soft
  },
  buttonText: { color: THEME.colors.white, fontSize: 14, fontWeight: '700' }
});

export default DashboardScreen;
