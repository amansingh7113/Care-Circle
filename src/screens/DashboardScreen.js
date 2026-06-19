import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Linking, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Pill } from 'lucide-react-native';
import { getCircleDetails } from '../services/circleApi';
import { getSleepLogs } from '../services/sleepApi';
import { getMedicines, logAdministration } from '../services/medicineApi';
import { getVitals } from '../services/vitalsApi';
import { getSteps } from '../services/stepApi';
import { getDoctorVisits } from '../services/doctorVisitApi';
import { getTodayHydration, logHydration } from '../services/hydrationApi';
import { THEME } from '../styles/theme';
import CircularProgressRing from '../components/CircularProgressRing';
import { useStore } from '../store/useStore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generatePdfTemplate } from '../utils/pdfTemplate';
import LogBloodPressureModal from './home/LogBloodPressureModal';
import AdBanner from '../components/AdBanner';

const vitalsConfig = [
  { id: '1', label: 'Blood Pressure', value: '--/--', icon: '❤️', color: THEME.colors.alert },
  { id: '2', label: 'Medication', value: '--', icon: 'Pill', color: THEME.colors.primary, subLabel: 'No meds', upcoming: false },
  { id: '3', label: 'Daily Steps', value: '0', icon: '👣', color: '#3BA0E3' },
  { id: '4', label: 'Sleep', value: '--h --m', icon: '🌙', color: '#FCD34D' },
];

const DashboardScreen = ({ route, navigation }) => {
  const { circleId, circleName = 'My Circle' } = route.params || {};
  const [members, setMembers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bpModalVisible, setBpModalVisible] = useState(false);
  const { bloodPressureLogs, sleepLogs, stepLogs, setBloodPressureLogs, setSleepLogs, setStepLogs, user, subscribeToCircle, unsubscribeFromCircle, lastHeartbeat } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loggingMedId, setLoggingMedId] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [loggingWater, setLoggingWater] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const holdProgress = useRef(new Animated.Value(0)).current;

  const triggerSOS = async () => {
    try {
      const circleData = await getCircleDetails(circleId);
      
      let locationString = "Location tracking unavailable";
      if (circleData?.last_known_location?.latitude && circleData?.last_known_location?.longitude) {
        locationString = `https://www.google.com/maps/search/?api=1&query=${circleData.last_known_location.latitude},${circleData.last_known_location.longitude}`;
      }
      
      const rawText = `🚨 *CARECIRCLE EMERGENCY ALERT* 🚨\n\nImmediate attention required for our family Care Circle.\n- Triggered Remotely By: ${user?.full_name || 'CareCircle User'}\n- *Dad's Current Location:* ${locationString}\n\nPlease check on him immediately!`;
      
      const encodedText = encodeURIComponent(rawText);
      const whatsAppUrl = `https://wa.me/?text=${encodedText}`;
      
      try {
        await Linking.openURL(whatsAppUrl);
      } catch (err) {
        Alert.alert("Emergency Alert", rawText);
      }
    } catch (error) {
      console.error('Error triggering SOS', error);
      Alert.alert("Emergency Alert", "Failed to send emergency alert.");
    }
  };

  const handleSosPressIn = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        triggerSOS();
        Animated.timing(holdProgress, {
           toValue: 0,
           duration: 200,
           useNativeDriver: false,
        }).start();
      }
    });
  };

  const handleSosPressOut = () => {
    holdProgress.stopAnimation();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

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
        setMembers([]);
      }
    }, [circleId])
  );

  useEffect(() => {
    if (circleId) {
      subscribeToCircle(circleId);
    }
    return () => {
      unsubscribeFromCircle();
    };
  }, [circleId]);

  useEffect(() => {
    if (lastHeartbeat) {
      fetchCircleData();
    }
  }, [lastHeartbeat]);

  const fetchCircleData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Run API calls in parallel for better performance
      const [circleData, dashboardData, hydrationData] = await Promise.all([
        getCircleDetails(circleId).catch(() => ({ members: [] })),
        getDashboardAggregated(circleId).catch(() => ({ vitals: [], sleep: [], steps: [], medicines: [], tasks: [] })),
        getTodayHydration().catch(() => ({ total_ml: 0 }))
      ]);
      
      setMembers(circleData?.members || []);
      setHydrationMl(hydrationData?.total_ml || 0);
      setSleepLogs(Array.isArray(dashboardData?.sleep) ? dashboardData.sleep : []);
      setBloodPressureLogs(Array.isArray(dashboardData?.vitals) ? dashboardData.vitals : []);
      setMedicines(dashboardData?.medicines || (Array.isArray(dashboardData?.medicines) ? dashboardData.medicines : []));
      setStepLogs(Array.isArray(dashboardData?.steps) ? dashboardData.steps : []);
      setTasks(Array.isArray(dashboardData?.tasks) ? dashboardData.tasks : []);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
      Alert.alert('Error', 'Failed to load some dashboard details');
    } finally {
      setIsLoading(false);
    }
  }, [circleId, setBloodPressureLogs, setSleepLogs, setStepLogs]);

  const getInitials = (name) => {
    return name ? name.substring(0, 2).toUpperCase() : 'U';
  };

  const getMedTime = (med) => med?.time || med?.scheduled_time || (med?.instructions?.scheduled_times ? med.instructions.scheduled_times[0] : 'Upcoming');

  const pendingMeds = (medicines || []).filter(m => m.status !== 'taken');
  const nextMed = pendingMeds.length > 0 ? pendingMeds[0] : null;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const handleLogNextMed = async () => {
    if (!nextMed) return;
    
    const previousStatus = nextMed.status;
    // Optimistic Update
    setMedicines(current => current.map(m => m.id === nextMed.id ? { ...m, status: 'taken' } : m));
    setLoggingMedId(nextMed.id);
    
    try {
      const scheduledTime = nextMed.scheduled_time || (nextMed.instructions?.scheduled_times ? nextMed.instructions.scheduled_times[0] : null);
      await logAdministration(nextMed.id, 'taken', scheduledTime);
      setLoggingMedId(null);
    } catch (error) {
      // Revert on failure
      setMedicines(current => current.map(m => m.id === nextMed.id ? { ...m, status: previousStatus } : m));
      setLoggingMedId(null);
      Alert.alert('Error', 'Failed to log medication. Please try again.');
    }
  };

  const handleLogWater = async () => {
    if (loggingWater) return;
    setLoggingWater(true);
    try {
      const data = await logHydration(250);
      setHydrationMl(data.total_ml);
    } catch (e) {
      Alert.alert('Error', 'Failed to log water');
    } finally {
      setLoggingWater(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCircleData();
    setRefreshing(false);
  }, [circleId, fetchCircleData]);

  const handleShareMedicalReport = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      let visits = [];
      try {
        visits = await getDoctorVisits(circleId);
      } catch (e) {
        console.warn('Failed to fetch doctor visits', e);
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentVisits = visits.filter(v => new Date(v.visit_date || v.created_at) >= thirtyDaysAgo);
      const recentVitals = bloodPressureLogs.filter(v => new Date(v.created_at || v.timestamp) >= thirtyDaysAgo);

      const htmlContent = generatePdfTemplate({
        patientName: circleName,
        vitals: recentVitals,
        medicines: medicines,
        doctorVisits: recentVisits,
        generatedDate: new Date().toLocaleString()
      });

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Medical Report',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate medical report.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[THEME.colors.primary]} />
        }
      >
        
        {/* Module: Emergency SOS Banner */}
        <View style={styles.sosSection}>
          <Pressable 
            onPressIn={handleSosPressIn}
            onPressOut={handleSosPressOut}
            style={styles.sosContainer}
          >
            <Animated.View style={[styles.sosProgressBar, {
              width: holdProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              })
            }]} />
            <View style={styles.sosContent}>
              <Text style={styles.sosTitle}>🚨 EMERGENCY SOS</Text>
              <Text style={styles.sosSubtitle}>Hold for 3 seconds to alert Care Circle</Text>
            </View>
          </Pressable>
        </View>

        {/* Module: Daily Progress Hero Card */}
        <View style={styles.progressSection}>
          <View style={styles.progressCard}>
            <CircularProgressRing progress={taskProgress} size={110} strokeWidth={14} color={THEME.colors.primary} />
            <View style={styles.progressInfo}>
              <Text style={styles.progressValue}>{taskProgress}%</Text>
              <Text style={styles.progressLabel}>TASKS COMPLETED</Text>
            </View>
          </View>
        </View>

        {/* Module: Single-Tap Interactive Medication Card */}
        {nextMed && (
          <View style={styles.nextMedSection}>
            <View style={styles.nextMedCard}>
              <View style={styles.nextMedInfo}>
                <View style={styles.nextMedHeader}>
                  <Text style={styles.nextMedTime}>{getMedTime(nextMed)}</Text>
                  <Animated.View style={{ opacity: pulseAnim, marginLeft: 8 }}>
                    <Pill size={20} color={THEME.colors.white} />
                  </Animated.View>
                </View>
                <Text style={styles.nextMedName}>{nextMed.name}</Text>
                <Text style={styles.nextMedDosage}>{nextMed.dosage}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.logButton, loggingMedId === nextMed.slot_id && styles.logButtonDisabled]}
                onPress={handleLogNextMed}
                disabled={loggingMedId === nextMed.slot_id}
                activeOpacity={0.8}
              >
                {loggingMedId === nextMed.slot_id ? (
                  <ActivityIndicator color={THEME.colors.primary} />
                ) : (
                  <Text style={styles.logButtonText}>TAKE NOW</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Module: Hydration Tracker */}
        <View style={styles.hydrationSection}>
          <View style={styles.hydrationCard}>
            <View style={{flex: 1}}>
              <Text style={styles.hydrationTitle}>Daily Hydration</Text>
              <Text style={styles.hydrationValue}>{hydrationMl} <Text style={{fontSize: 16, color: THEME.colors.textBody}}>out of 2000 ml</Text></Text>
              <View style={[styles.vitalBarContainer, { backgroundColor: '#E0F2FE', marginTop: 8 }]}>
                <View style={[styles.vitalBarFill, { backgroundColor: '#0EA5E9', width: `${Math.min(100, (hydrationMl/2000)*100)}%` }]} />
              </View>
            </View>
            <TouchableOpacity 
              style={styles.waterButton} 
              onPress={handleLogWater}
              disabled={loggingWater}
            >
              {loggingWater ? <ActivityIndicator color="#FFF" /> : <Text style={styles.waterButtonText}>+ 250ml 💧</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Module B: Wellness Vitals Quick-Grid */}
        <View style={styles.vitalsSection}>
          <Text style={styles.sectionTitle}>Vitals</Text>
          <View style={styles.vitalsGrid}>
            {vitalsConfig.map(vital => {
              const isBP = vital.label === 'Blood Pressure';
              const isSleep = vital.label === 'Sleep';
              const isMedication = vital.label === 'Medication';
              const isSteps = vital.label === 'Daily Steps';
              
              let displayValue = vital.value;
              let currentSubLabel = vital.subLabel;
              let currentUpcoming = vital.upcoming;

              if (isBP && bloodPressureLogs?.length > 0) displayValue = latestBp;
              if (isSleep && sleepLogs?.length > 0) displayValue = latestSleep;
              if (isSteps) {
                const today = new Date().toISOString().split('T')[0];
                const todaySteps = stepLogs?.find(s => s.date === today)?.step_count || 0;
                displayValue = `${todaySteps}`;
              }
              if (isMedication) {
                const pendingMeds = (medicines || []).filter(m => m.status !== 'taken');
                const nextMed = pendingMeds.length > 0 ? pendingMeds[0] : null;
                currentUpcoming = !!nextMed;
                displayValue = nextMed ? getMedTime(nextMed) : 'All Taken';
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
                      navigation.navigate('SleepDetails');
                    }
                    if (isSteps) navigation.navigate('StepHistory');
                  }}
                  activeOpacity={(isBP || isSleep || isMedication || isSteps) ? 0.7 : 1}
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
                  {(isSleep || isSteps) && <Text style={{fontSize: 10, color: THEME.colors.textMuted, marginTop: 4, fontWeight: '600'}}>AUTO</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Module A: Live Care Circle Activity Feed Timeline */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Task Feed</Text>
          <View style={styles.timelineContainer}>
            {pendingTasks.slice(0, 5).map((task, index) => (
              <View key={task.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIconBadge, { backgroundColor: `${THEME.colors.success}20` }]}>
                       <Text style={{fontSize: 12}}>📋</Text>
                  </View>
                  {index !== Math.min(pendingTasks.length, 5) - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.activityText}>
                    <Text style={styles.activityUser}>{task.assigned_to ? members.find(m => m.id === task.assigned_to)?.name || 'Someone' : 'Anyone'}</Text> needs to complete: {task.title}
                  </Text>
                  <Text style={styles.activityTime}>{task.status.toUpperCase()}</Text>
                </View>
              </View>
            ))}
            {pendingTasks.length === 0 && <Text style={{color: THEME.colors.textMuted, marginTop: 10, textAlign: 'center'}}>No pending tasks!</Text>}
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
          <View style={[styles.shortcutsRow, { marginTop: 12 }]}>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: '#43A047' }]}
              onPress={() => navigation.navigate('DoctorVisits')}
            >
              <Text style={styles.buttonText}>Doctor Visits</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: '#E53935' }]}
              onPress={() => navigation.navigate('Expenses')}
            >
              <Text style={styles.buttonText}>Expenses</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.shortcutsRow, { marginTop: 12 }]}>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: '#FFB300' }]}
              onPress={() => navigation.navigate('Documents')}
            >
              <Text style={styles.buttonText}>Documents Hub</Text>
            </TouchableOpacity>
            <View style={[styles.shortcutButton, { backgroundColor: 'transparent', elevation: 0 }]} />
          </View>
          <View style={[styles.shortcutsRow, { marginTop: 12 }]}>
            <TouchableOpacity 
              style={[styles.shortcutButton, { backgroundColor: THEME.colors.primary, width: '100%', flexDirection: 'row', justifyContent: 'center' }]}
              onPress={handleShareMedicalReport}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <ActivityIndicator color={THEME.colors.white} />
              ) : (
                <>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>📄</Text>
                  <Text style={styles.buttonText}>Share Medical Report (PDF)</Text>
                </>
              )}
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.settingsIcon} onPress={() => navigation.navigate('Notifications')}>
                 <Text style={{fontSize: 24, color: THEME.colors.primary}}>🔔</Text>
                 <View style={styles.notificationBadge}>
                   <Text style={styles.notificationBadgeText}>3</Text>
                 </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsIcon} onPress={() => navigation.navigate('Settings')}>
                 {/* Gear icon placeholder */}
                 <Text style={{fontSize: 24, color: THEME.colors.primary}}>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </BlurView>
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
  settingsIcon: { padding: 4, position: 'relative', marginLeft: 8 },
  notificationBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: THEME.colors.alert || '#E53935', borderRadius: 10, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  notificationBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 16, marginTop: 8 },
  
  // Emergency SOS Banner Styles
  sosSection: { marginBottom: 24 },
  sosContainer: {
    backgroundColor: '#FFEAEA',
    borderRadius: THEME.borderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFCACA',
    ...THEME.shadows.soft,
    position: 'relative'
  },
  sosContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  sosTitle: {
    ...THEME.typography.header,
    color: THEME.colors.alert || '#E53935',
    fontSize: 20,
    marginBottom: 4
  },
  sosSubtitle: {
    ...THEME.typography.label,
    color: '#D32F2F',
  },
  sosProgressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFCDD2',
    zIndex: 1,
  },

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
  
  // Next Medication Card Styles
  nextMedSection: { marginBottom: 24 },
  nextMedCard: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.card,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.medium,
  },
  nextMedInfo: { flex: 1, marginRight: 16 },
  nextMedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  nextMedTime: { color: THEME.colors.white, fontWeight: '700', fontSize: 16 },
  nextMedName: { color: THEME.colors.white, fontSize: 22, fontWeight: '800', marginBottom: 2 },
  nextMedDosage: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  logButton: {
    backgroundColor: THEME.colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    ...THEME.shadows.soft,
  },
  logButtonDisabled: { opacity: 0.7 },
  logButtonText: { color: THEME.colors.primary, fontWeight: '800', fontSize: 14 },

  // Hydration Styles
  hydrationSection: { marginBottom: 24 },
  hydrationCard: {
    backgroundColor: THEME.colors.white,
    padding: 20,
    borderRadius: THEME.borderRadius.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.soft,
    borderWidth: 1,
    borderColor: '#E0F2FE'
  },
  hydrationTitle: { color: '#0EA5E9', fontWeight: '700', marginBottom: 4 },
  hydrationValue: { fontSize: 24, fontWeight: '800', color: THEME.colors.textHeader },
  waterButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 16
  },
  waterButtonText: { color: THEME.colors.white, fontWeight: 'bold' },
  
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
