import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Linking, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pill, Bell, Settings, ShieldAlert, Droplet, Camera, Heart, Footprints, Moon, CheckCircle2, Stethoscope, DollarSign, FileText, ClipboardList } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { getCircleDetails } from '../services/circleApi';
import { getSleepLogs } from '../services/sleepApi';
import { getMedicines, logAdministration } from '../services/medicineApi';
import { getVitals } from '../services/vitalsApi';
import { getSteps } from '../services/stepApi';
import { getDoctorVisits } from '../services/doctorVisitApi';
import { getTodayHydration, logHydration } from '../services/hydrationApi';
import { getTodayNutrition, logNutrition, scanMeal } from '../services/nutritionApi';
import { syncWearableSteps } from '../services/wearablesApi';
import { THEME } from '../styles/theme';
import CircularProgressRing from '../components/CircularProgressRing';
import { useStore } from '../store/useStore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generatePdfTemplate } from '../utils/pdfTemplate';
import LogBloodPressureModal from './home/LogBloodPressureModal';
import AdBanner from '../components/AdBanner';
import api from '../services/api';
import Card from '../components/Card';

const vitalsConfig = [
  { id: '1', label: 'Blood Pressure', value: '--/--', icon: 'Heart', color: THEME.colors.alert, bg: THEME.colors.alertLight },
  { id: '2', label: 'Medication', value: '--', icon: 'Pill', color: THEME.colors.primary, bg: THEME.colors.primaryLight, subLabel: 'No meds', upcoming: false },
  { id: '3', label: 'Daily Steps', value: '0', icon: 'Footprints', color: '#3BA0E3', bg: THEME.colors.infoLight },
  { id: '4', label: 'Sleep', value: '--h --m', icon: 'Moon', color: '#FCD34D', bg: THEME.colors.warningLight },
];

const DashboardScreen = ({ route, navigation }) => {
  const { bloodPressureLogs, sleepLogs, stepLogs, setBloodPressureLogs, setSleepLogs, setStepLogs, user, subscribeToCircle, unsubscribeFromCircle, lastHeartbeat, currentCircle } = useStore();
  const circleId = route.params?.circleId || currentCircle?.id;
  const circleName = route.params?.circleName || currentCircle?.name || 'My Circle';
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bpModalVisible, setBpModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingMedId, setLoggingMedId] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [nutritionCalories, setNutritionCalories] = useState(0);
  const [isScanningMeal, setIsScanningMeal] = useState(false);
  const [isSyncingWearable, setIsSyncingWearable] = useState(false);
  const [loggingWater, setLoggingWater] = useState(false);

  const triggerSOS = async () => {
    Alert.alert(
      "🚨 Emergency SOS",
      `Are you sure you want to trigger an emergency alert for ${circleName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Trigger SOS", 
          style: "destructive",
          onPress: async () => {
            try {
              const circleData = await getCircleDetails(circleId);
              let locationString = "Location tracking unavailable";
              if (circleData?.last_known_location?.latitude && circleData?.last_known_location?.longitude) {
                locationString = `https://www.google.com/maps/search/?api=1&query=${circleData.last_known_location.latitude},${circleData.last_known_location.longitude}`;
              }
              const rawText = `🚨 *CARECIRCLE EMERGENCY ALERT* 🚨\n\nImmediate attention required for our family Care Circle.\n- Triggered Remotely By: ${user?.full_name || 'CareCircle User'}\n- *Current Location:* ${locationString}\n\nPlease check immediately!`;
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
          }
        }
      ]
    );
  };

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
    if (circleId) {
      try {
        const [dashboardResponse, hydrationData, nutritionData] = await Promise.all([
          api.get('/api/v1/dashboard', { params: { circle_id: circleId } }),
          getTodayHydration().catch(() => ({ total_ml: 0 })),
          getTodayNutrition().catch(() => ({ total_calories: 0 }))
        ]);
        
        const dashboardData = dashboardResponse.data?.data;
        setBloodPressureLogs(Array.isArray(dashboardData?.vitals) ? dashboardData.vitals : []);
        setSleepLogs(Array.isArray(dashboardData?.sleep) ? dashboardData.sleep : []);
        const serverSteps = Array.isArray(dashboardData?.steps) ? dashboardData.steps : [];
        const today = new Date().toISOString().split('T')[0];
        const currentLocalLogs = useStore.getState().stepLogs || [];
        const localTodayLog = currentLocalLogs.find(s => s.date === today);
        const serverTodayLog = serverSteps.find(s => s.date === today);
        
        let mergedSteps = [...serverSteps];
        if (localTodayLog) {
           const maxTodayCount = Math.max(localTodayLog.step_count || 0, serverTodayLog?.step_count || 0);
           const serverIndex = mergedSteps.findIndex(s => s.date === today);
           if (serverIndex !== -1) {
              mergedSteps[serverIndex] = { ...mergedSteps[serverIndex], step_count: maxTodayCount };
           } else {
              mergedSteps.unshift({ date: today, step_count: maxTodayCount });
           }
        }
        setStepLogs(mergedSteps);
        setMedicines(Array.isArray(dashboardData?.medicines) ? dashboardData.medicines : []);
        setTasks(Array.isArray(dashboardData?.tasks) ? dashboardData.tasks : []);
        setHydrationMl(hydrationData?.total_ml || 0);
        setNutritionCalories(nutritionData?.total_calories || 0);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
        Alert.alert('Error', 'Failed to load some dashboard details');
      } finally {
        setIsLoading(false);
      }
    }
  }, [circleId, setBloodPressureLogs, setSleepLogs, setStepLogs]);

  const handleScanMeal = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant camera access.');
        return;
      }
      const pickerResult = await ImagePicker.launchCameraAsync({
        quality: 0.5,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      setIsScanningMeal(true);
      const res = await scanMeal(pickerResult.assets[0].uri);
      
      if (res && res.calories) {
        Alert.alert(
          'Meal Scanned 🥗', 
          `Identified: ${res.food_items}\nEstimated Calories: ${res.calories} kcal\nSugar: ${res.sugar_g}g\nSodium: ${res.sodium_mg}mg\n\nLog this meal?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Meal', onPress: async () => {
                const logged = await logNutrition({
                  meal_type: res.meal_type || 'Snack',
                  food_items: res.food_items,
                  calories: res.calories,
                  sugar_g: res.sugar_g,
                  sodium_mg: res.sodium_mg,
                });
                setNutritionCalories(prev => prev + res.calories);
            }}
          ]
        );
      } else {
        Alert.alert('Not Found', 'Could not extract meal details.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to scan meal.');
    } finally {
      setIsScanningMeal(false);
    }
  };

  const handleSyncWearable = async () => {
    try {
      setIsSyncingWearable(true);
      const steps = await Promise.race([
        syncWearableSteps(circleId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timed out connecting to wearable/sensors. Please try again.')), 4000))
      ]);
      Alert.alert('Sync Complete', `Synced ${steps} steps from Google Fit/Health Connect.`);
      fetchCircleData().catch(e => console.log('fetchCircleData error:', e));
    } catch (err) {
      Alert.alert('Sync Error', err.message || 'Failed to sync wearable data.');
    } finally {
      setIsSyncingWearable(false);
    }
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
    setMedicines(current => current.map(m => m.id === nextMed.id ? { ...m, status: 'taken' } : m));
    setLoggingMedId(nextMed.id);
    
    try {
      const scheduledTime = nextMed.scheduled_time || (nextMed.instructions?.scheduled_times ? nextMed.instructions.scheduled_times[0] : null);
      await logAdministration(nextMed.id, 'taken', scheduledTime);
      setLoggingMedId(null);
    } catch (error) {
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
        {/* Module: Single-Tap Interactive Medication Card (Prominent Hero Element) */}
        {nextMed && (
          <View style={styles.nextMedSection}>
            <Text style={styles.sectionTitle}>Upcoming Medication</Text>
            <LinearGradient colors={THEME.gradients.primary} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.nextMedCard}>
              <View style={styles.nextMedInfo}>
                <View style={styles.nextMedHeader}>
                  <Text style={styles.nextMedTime}>{getMedTime(nextMed)}</Text>
                  <Pill size={20} color={THEME.colors.white} style={{ marginLeft: 8 }} />
                </View>
                <Text style={styles.nextMedName}>{nextMed.name}</Text>
                <Text style={styles.nextMedDosage}>{nextMed.dosage}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.logButton, loggingMedId === nextMed.slot_id && styles.logButtonDisabled]}
                onPress={handleLogNextMed}
                disabled={loggingMedId === nextMed.slot_id}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Take ${nextMed.name} now`}
              >
                {loggingMedId === nextMed.slot_id ? (
                  <ActivityIndicator color={THEME.colors.primary} />
                ) : (
                  <Text style={styles.logButtonText}>TAKE NOW</Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {/* Bento Grid: Wellness Vitals */}
        <View style={styles.vitalsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Vitals Overview</Text>
            <TouchableOpacity 
              onPress={handleSyncWearable} 
              disabled={isSyncingWearable} 
              style={styles.syncBtn}
              accessibilityRole="button"
              accessibilityLabel="Sync Wearable"
            >
              <Text style={styles.syncBtnText}>
                {isSyncingWearable ? "Syncing..." : "⌚ Sync Wearable"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.vitalsGrid}>
            {vitalsConfig.map(vital => {
              const isBP = vital.label === 'Blood Pressure';
              const isSleep = vital.label === 'Sleep';
              const isMedication = vital.label === 'Medication';
              const isSteps = vital.label === 'Daily Steps';
              
              let displayValue = vital.value;
              let currentSubLabel = vital.subLabel;

              if (isBP && bloodPressureLogs?.length > 0) displayValue = latestBp;
              if (isSleep && sleepLogs?.length > 0) displayValue = latestSleep;
              if (isSteps) {
                const today = new Date().toISOString().split('T')[0];
                const todaySteps = stepLogs?.find(s => s.date === today)?.step_count || 0;
                displayValue = `${todaySteps}`;
              }
              if (isMedication) {
                if (nextMed) return null;
                displayValue = 'All Taken';
                currentSubLabel = 'No pending meds';
              }

              return (
                <TouchableOpacity 
                  key={vital.id} 
                  style={styles.vitalCard}
                  onPress={() => {
                    if (isBP) setBpModalVisible(true);
                    if (isMedication) navigation.navigate('MedicineTracker');
                    if (isSleep) navigation.navigate('SleepDetails');
                    if (isSteps) navigation.navigate('StepHistory');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${vital.label}, ${displayValue}`}
                >
                  <View style={styles.vitalHeaderRow}>
                    <View style={[styles.vitalIconBadge, { backgroundColor: vital.bg }]}>
                      {isMedication ? (
                        <Pill size={20} color={vital.color} />
                      ) : isBP ? (
                        <Heart size={20} color={vital.color} />
                      ) : isSleep ? (
                        <Moon size={20} color={vital.color} />
                      ) : (
                        <Footprints size={20} color={vital.color} />
                      )}
                    </View>
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

        {/* Bento Grid: Care Management & Quick Access */}
        <View style={styles.shortcutsContainer}>
          <Text style={styles.sectionTitle}>Care Management</Text>
          <View style={styles.shortcutsRow}>
            <TouchableOpacity 
              style={styles.shortcutCard}
              onPress={() => navigation.navigate('DoctorVisits')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Navigate to Doctor Visits"
            >
              <View style={[styles.shortcutIconBadge, { backgroundColor: THEME.colors.successLight }]}>
                <Stethoscope size={22} color={THEME.colors.success} />
              </View>
              <Text style={styles.shortcutCardText}>Doctor Visits</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.shortcutCard}
              onPress={() => navigation.navigate('Expenses')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Navigate to Expenses"
            >
              <View style={[styles.shortcutIconBadge, { backgroundColor: THEME.colors.alertLight }]}>
                <DollarSign size={22} color={THEME.colors.alert} />
              </View>
              <Text style={styles.shortcutCardText}>Expenses</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.shortcutsRow, { marginTop: 16 }]}>
            <TouchableOpacity 
              style={styles.shortcutCard}
              onPress={() => navigation.navigate('Documents')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Navigate to Documents Hub"
            >
              <View style={[styles.shortcutIconBadge, { backgroundColor: THEME.colors.warningLight }]}>
                <FileText size={22} color={THEME.colors.warning} />
              </View>
              <Text style={styles.shortcutCardText}>Documents Hub</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.shortcutCard, { backgroundColor: THEME.colors.primaryLight }]}
              onPress={handleShareMedicalReport}
              disabled={isGeneratingPdf}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share Medical Report"
            >
              <View style={[styles.shortcutIconBadge, { backgroundColor: THEME.colors.white }]}>
                {isGeneratingPdf ? (
                  <ActivityIndicator color={THEME.colors.primary} />
                ) : (
                  <FileText size={22} color={THEME.colors.primary} />
                )}
              </View>
              <Text style={[styles.shortcutCardText, { color: THEME.colors.primary }]}>Share Report</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bento Grid: Daily Progress & Nutrition */}
        <View style={styles.wellnessSection}>
          <Text style={styles.sectionTitle}>Daily Progress</Text>

          {/* Daily Tasks Progress Banner */}
          <View style={styles.taskProgressCard}>
            <CircularProgressRing progress={taskProgress} size={64} strokeWidth={8} color={THEME.colors.primary} />
            <View style={styles.taskProgressInfo}>
              <Text style={styles.taskProgressTitle}>Daily Task Fulfillment</Text>
              <Text style={styles.taskProgressSubtitle}>{completedTasks} of {totalTasks} tasks completed today</Text>
            </View>
            <Text style={styles.taskProgressPercent}>{taskProgress}%</Text>
          </View>

          {/* Hydration & Diet Widget */}
          <View style={styles.hydrationContainer}>
            <View style={{flex: 1}}>
              <Text style={styles.sectionTitle}>Daily Water Goal</Text>
              <Text style={styles.hydrationText}>{hydrationMl} ml / 2000 ml</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min((hydrationMl / 2000) * 100, 100)}%` }]} />
              </View>
              <TouchableOpacity 
                style={styles.logWaterBtn} 
                onPress={handleLogWater}
                accessibilityRole="button"
                accessibilityLabel="Log 250ml of water"
              >
                <Droplet size={18} color={THEME.colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.logWaterBtnText}>+ 250ml</Text>
              </TouchableOpacity>
            </View>
            <View style={{flex: 1, marginLeft: 16}}>
              <Text style={styles.sectionTitle}>Diet Intake</Text>
              <Text style={styles.hydrationText}>{nutritionCalories} kcal logged</Text>
              <View style={[styles.progressBarBg, { backgroundColor: THEME.colors.warningLight }]}>
                <View style={[styles.progressBarFill, { width: `${Math.min((nutritionCalories / 2500) * 100, 100)}%`, backgroundColor: THEME.colors.warning }]} />
              </View>
              <TouchableOpacity 
                style={[styles.logWaterBtn, {backgroundColor: THEME.colors.warning}]} 
                onPress={handleScanMeal} 
                disabled={isScanningMeal}
                accessibilityRole="button"
                accessibilityLabel="Scan Meal"
              >
                <Camera size={18} color={THEME.colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.logWaterBtnText}>{isScanningMeal ? "Scanning..." : "Scan Meal"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Live Care Circle Activity Feed Timeline */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Task Feed</Text>
          <View style={styles.timelineContainer}>
            {pendingTasks.slice(0, 5).map((task, index) => (
              <View key={task.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIconBadge, { backgroundColor: THEME.colors.successLight }]}>
                       <CheckCircle2 size={18} color={THEME.colors.success} />
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
            {pendingTasks.length === 0 && <Text style={{color: THEME.colors.textMuted, marginTop: 10, textAlign: 'center', fontFamily: 'Inter_500Medium'}}>No pending tasks!</Text>}
          </View>
        </View>
        
        <View style={{height: 40}} />
      </ScrollView>

      {/* Blurred Header with Floating SOS Button */}
      <BlurView intensity={90} tint="light" style={[styles.blurHeader, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 20) : 0 }]}>
        <SafeAreaView>
          <View style={styles.headerContainer}>
            <Text style={[styles.header, { flexShrink: 1, marginRight: 10 }]} numberOfLines={1} ellipsizeMode="tail">{circleName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity 
                style={styles.sosHeaderBtn} 
                onPress={triggerSOS}
                accessibilityRole="button"
                accessibilityLabel="Trigger Emergency SOS"
              >
                 <ShieldAlert size={18} color={THEME.colors.white} style={{ marginRight: 4 }} />
                 <Text style={styles.sosHeaderBtnText}>SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.settingsIcon} 
                onPress={() => navigation.navigate('Notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                 <Bell size={24} color={THEME.colors.primary} />
                 <View style={styles.notificationBadge}>
                   <Text style={styles.notificationBadgeText}>3</Text>
                 </View>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </BlurView>

      <LogBloodPressureModal 
        visible={bpModalVisible} 
        onClose={() => setBpModalVisible(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 110, paddingBottom: 40 },
  blurHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 20 },
  headerContainer: { marginTop: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { ...THEME.typography.header, color: THEME.colors.primary },
  sosHeaderBtn: { 
    backgroundColor: THEME.colors.danger, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 20, 
    minHeight: 48, 
    justifyContent: 'center',
    ...THEME.shadows.soft 
  },
  sosHeaderBtnText: { color: THEME.colors.white, fontFamily: 'Inter_700Bold', fontSize: 14, fontWeight: '700' },
  settingsIcon: { padding: 12, position: 'relative', marginLeft: 8, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: THEME.colors.alert, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: THEME.colors.canvas },
  notificationBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 14, marginTop: 6, fontSize: 18 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 6 },

  // Vitals Grid Styles
  vitalsSection: { marginBottom: 24 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  vitalCard: {
    width: '48%', backgroundColor: THEME.colors.cardBg,
    padding: 18, borderRadius: THEME.borderRadius.card,
    marginBottom: 16, ...THEME.shadows.medium,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'space-between',
    minHeight: 115
  },
  vitalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  vitalIconBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  vitalValue: { ...THEME.typography.cardTitle, fontSize: 20 },
  vitalBarContainer: { height: 5, borderRadius: 2.5, width: '100%', marginBottom: 10 },
  vitalBarFill: { height: '100%', borderRadius: 2.5 },
  vitalLabel: { ...THEME.typography.label, fontSize: 10 },
  vitalSubLabel: { ...THEME.typography.label, color: THEME.colors.textMuted, marginBottom: 8, fontSize: 11 },

  // Shortcuts / Bento Grid Styles
  shortcutsContainer: { marginBottom: 24 },
  shortcutsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shortcutCard: {
    width: '48%',
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 18,
    ...THEME.shadows.medium,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center'
  },
  shortcutIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  shortcutCardText: { ...THEME.typography.cardTitle, fontSize: 14, textAlign: 'center' },

  // Next Medication Card Styles
  nextMedSection: { marginBottom: 24 },
  nextMedCard: {
    borderRadius: THEME.borderRadius.card,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.medium,
  },
  nextMedInfo: { flex: 1, marginRight: 16 },
  nextMedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  nextMedTime: { color: THEME.colors.white, fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 15 },
  nextMedName: { color: THEME.colors.white, fontFamily: 'Inter_700Bold', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  nextMedDosage: { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_500Medium', fontSize: 13, fontWeight: '500' },
  logButton: {
    backgroundColor: THEME.colors.white,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 25,
    ...THEME.shadows.soft,
  },
  logButtonDisabled: { opacity: 0.7 },
  logButtonText: { color: THEME.colors.primary, fontFamily: 'Inter_700Bold', fontWeight: '800', fontSize: 13 },

  // Wellness & Progress Section Styles
  wellnessSection: { marginBottom: 24 },
  syncBtn: { backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, minHeight: 48, justifyContent: 'center' },
  syncBtnText: { fontFamily: 'Inter_700Bold', fontSize: 12, fontWeight: 'bold', color: THEME.colors.primary },
  
  taskProgressCard: {
    backgroundColor: THEME.colors.cardBg,
    padding: 18,
    borderRadius: THEME.borderRadius.card,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    ...THEME.shadows.medium,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  taskProgressInfo: { marginLeft: 16, flex: 1 },
  taskProgressTitle: { ...THEME.typography.cardTitle, fontSize: 15, marginBottom: 2 },
  taskProgressSubtitle: { ...THEME.typography.label, color: THEME.colors.textBody, fontSize: 12 },
  taskProgressPercent: { ...THEME.typography.header, fontSize: 22, color: THEME.colors.primary, marginLeft: 10 },

  // Hydration & Diet Styles
  hydrationContainer: { backgroundColor: THEME.colors.cardBg, borderRadius: THEME.borderRadius.card, padding: 18, marginBottom: 16, ...THEME.shadows.medium, borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  hydrationText: { fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 13, color: THEME.colors.textBody, marginBottom: 8 },
  progressBarBg: { height: 6, backgroundColor: '#e0f2fe', borderRadius: 3, marginBottom: 14 },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: THEME.colors.primary },
  logWaterBtn: { backgroundColor: THEME.colors.primary, paddingVertical: 12, borderRadius: THEME.borderRadius.button, flexDirection: 'row', alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  logWaterBtnText: { color: THEME.colors.white, fontFamily: 'Inter_700Bold', fontSize: 14, fontWeight: '800' },

  // Activity Feed Styles
  activitySection: { marginBottom: 28 },
  timelineContainer: { paddingLeft: 4, marginTop: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 60 },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineIconBadge: { width: 32, height: 32, borderRadius: 16, zIndex: 2, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: `${THEME.colors.border}80`, position: 'absolute', top: 36, bottom: -4, zIndex: 1 },
  timelineContent: { flex: 1, paddingLeft: 16, paddingBottom: 24, paddingTop: 8 },
  activityText: { ...THEME.typography.body, marginBottom: 6 },
  activityUser: { fontFamily: 'Inter_700Bold', fontWeight: '700', color: THEME.colors.textHeader },
  activityTime: { ...THEME.typography.label, fontSize: 10, color: THEME.colors.textMuted }
});

export default DashboardScreen;
