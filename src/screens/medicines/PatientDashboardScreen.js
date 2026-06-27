import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { getMedicines, logAdministration } from '../../services/medicineApi';
import { getTodayHydration, logHydration } from '../../services/hydrationApi';
import { getTodayNutrition, logNutrition, scanMeal } from '../../services/nutritionApi';
import { triggerSos } from '../../services/notificationApi';
import api from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../../components/EmptyState';
import VoiceLogButton from '../../components/VoiceLogButton';
import { useStore } from '../../store/useStore';

const PatientDashboardScreen = ({ navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState(null);
  const [hydrationMl, setHydrationMl] = useState(0);
  const [nutritionCalories, setNutritionCalories] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isScanningMeal, setIsScanningMeal] = useState(false);
  const [loggingWater, setLoggingWater] = useState(false);

  useEffect(() => {
    fetchPendingMedicines();
  }, [currentCircle]);

  const fetchPendingMedicines = async () => {
    if (!currentCircle?.id) return;
    try {
      setLoading(true);
      const loadData = async () => {
        try {
          const [hydrationData, nutritionData, streakRes] = await Promise.all([
            getTodayHydration().catch(() => ({ total_ml: 0 })),
            getTodayNutrition().catch(() => ({ total_calories: 0 })),
            api.get('/api/v1/users/streak').catch(() => ({ data: { streak: 0 } }))
          ]);
          setHydrationMl(hydrationData?.total_ml || 0);
          setNutritionCalories(nutritionData?.total_calories || 0);
          setStreak(streakRes?.data?.streak || 0);
        } catch (err) {
          console.error(err);
        }
      };
      loadData();
      const data = await getMedicines(currentCircle.id);
      const activeMeds = data.filter(m => m.status !== 'archived');
      setMedicines(activeMeds);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch medicines');
    } finally {
      setLoading(false);
    }
  };

  const handleLogAction = async (medicine, status) => {
    try {
      setLoggingId(medicine.id);
      let instructions = {};
      try {
        instructions = typeof medicine.instructions === 'string' ? JSON.parse(medicine.instructions) : (medicine.instructions || {});
        if (typeof instructions === 'string') instructions = JSON.parse(instructions);
      } catch(e) {}
      const scheduledTime = medicine.scheduled_time || (instructions.scheduled_times ? instructions.scheduled_times[0] : null);
      await logAdministration(medicine.id, status, scheduledTime);
      
      Alert.alert('Success', `Medicine marked as ${status}`);
      // Refresh the list or optimistically update
      fetchPendingMedicines();
    } catch (error) {
      Alert.alert('Error', `Failed to mark medicine as ${status}`);
    } finally {
      setLoggingId(null);
    }
  };

  const handleScanMeal = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please grant camera access.');
        return;
      }
      const pickerResult = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      setIsScanningMeal(true);
      const res = await scanMeal(pickerResult.assets[0].uri);
      
      if (res && res.calories) {
        Alert.alert(
          'Meal Scanned 🥗', 
          `Identified: ${res.food_items}\nCalories: ${res.calories} kcal\nSugar: ${res.sugar_g}g\nSodium: ${res.sodium_mg}mg\n\nLog this meal?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Meal', onPress: async () => {
                await logNutrition({
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
      Alert.alert('Error', 'Failed to scan meal.');
    } finally {
      setIsScanningMeal(false);
    }
  };

  const handleSos = () => {
    Alert.alert(
      'EMERGENCY SOS',
      'This will instantly alert all your caregivers. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'SEND SOS', 
          style: 'destructive',
          onPress: async () => {
            try {
              await triggerSos();
              Alert.alert('SOS Sent', 'Your caregivers have been notified.');
            } catch (err) {
              Alert.alert('Error', 'Failed to send SOS. Please call emergency services.');
            }
          }
        }
      ]
    );
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

  const renderItem = ({ item }) => {
    let instructions = {};
    try {
      instructions = typeof item.instructions === 'string' ? JSON.parse(item.instructions) : (item.instructions || {});
      if (typeof instructions === 'string') instructions = JSON.parse(instructions);
    } catch(e) {}
    const scheduledTime = item.scheduled_time || (instructions.scheduled_times ? instructions.scheduled_times.join(', ') : 'As needed');
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.dosage}>{item.dosage}</Text>
          </View>
          <View style={styles.timeBadge}>
             <Ionicons name="time-outline" size={16} color={THEME.colors.primary} />
             <Text style={styles.timeText}>{scheduledTime}</Text>
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.takenButton, loggingId === item.id && styles.buttonDisabled]} 
            onPress={() => handleLogAction(item, 'taken')}
            disabled={loggingId === item.id}
          >
            <Text style={styles.buttonText}>TAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.skipButton, loggingId === item.id && styles.buttonDisabled]} 
            onPress={() => handleLogAction(item, 'skipped')}
            disabled={loggingId === item.id}
          >
            <Text style={styles.buttonText}>SKIP</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerGreeting}>Hi, {user?.name?.split(' ')[0] || 'Patient'}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4}}>
              <Text style={styles.subGreeting}>How are you feeling today?</Text>
              {streak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streak} Day Streak</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.settingsIcon} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={24} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* SOS Button */}
        <TouchableOpacity style={styles.sosButton} onPress={handleSos}>
          <Ionicons name="alert-circle-outline" size={24} color={THEME.colors.white} />
          <Text style={styles.sosText}>EMERGENCY SOS</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={medicines}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <>
                {/* Hydration & Diet Widget */}
                <View style={styles.hydrationContainer}>
                  <View style={{flex: 1}}>
                    <Text style={styles.sectionTitle}>Daily Water</Text>
                    <Text style={styles.hydrationText}>{hydrationMl} ml</Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min((hydrationMl / 2000) * 100, 100)}%` }]} />
                    </View>
                    <TouchableOpacity style={styles.logWaterBtn} onPress={handleLogWater} disabled={loggingWater}>
                      <Text style={styles.logWaterBtnText}>{loggingWater ? "..." : "+ 250ml 💧"}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{flex: 1, marginLeft: 16}}>
                    <Text style={styles.sectionTitle}>Diet</Text>
                    <Text style={styles.hydrationText}>{nutritionCalories} kcal</Text>
                    <View style={[styles.progressBarBg, { backgroundColor: '#fcd34d' }]}>
                      <View style={[styles.progressBarFill, { width: `${Math.min((nutritionCalories / 2500) * 100, 100)}%`, backgroundColor: '#fbbf24' }]} />
                    </View>
                    <TouchableOpacity style={[styles.logWaterBtn, {backgroundColor: '#f59e0b'}]} onPress={handleScanMeal} disabled={isScanningMeal}>
                      <Text style={styles.logWaterBtnText}>{isScanningMeal ? "..." : "📷 Scan Meal"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Your Medicines for Today</Text>
              </>
            }
            ListEmptyComponent={
              <EmptyState 
                iconName="medkit" 
                titleText="All caught up!" 
                subtitleText="You have no pending medicines at the moment." 
              />
            }
          />
        )}
      </View>
      <VoiceLogButton circleId={currentCircle?.id} onSuccess={fetchPendingMedicines} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { padding: 20, paddingTop: 40, backgroundColor: THEME.colors.white, ...THEME.shadows.soft, marginBottom: 10 },
  headerGreeting: { ...THEME.typography.header, fontSize: 28, color: THEME.colors.primary, marginBottom: 4 },
  subGreeting: { fontSize: 16, color: THEME.colors.textBody, marginTop: 4 },
  streakBadge: { backgroundColor: '#fef08a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 8 },
  streakText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  settingsIcon: { padding: 4 },
  sosButton: { 
    flexDirection: 'row', 
    backgroundColor: THEME.colors.danger, 
    marginTop: 20, 
    paddingVertical: 14, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...THEME.shadows.medium 
  },
  sosText: { color: THEME.colors.white, fontSize: 18, fontWeight: '800', marginLeft: 8, letterSpacing: 1 },
  container: { flex: 1 },
  listContent: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.colors.textHeader, marginBottom: 8 },
  hydrationContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, flexDirection: 'row', justifyContent: 'space-between' },
  card: { backgroundColor: THEME.colors.white, padding: 20, marginVertical: 10, borderRadius: 16, ...THEME.shadows.medium },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: THEME.colors.textHeader, marginBottom: 4 },
  dosage: { fontSize: 16, color: THEME.colors.textBody, fontWeight: '600' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${THEME.colors.primary}15`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  timeText: { marginLeft: 6, color: THEME.colors.primary, fontWeight: '700' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  button: { flex: 1, height: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginHorizontal: 6, ...THEME.shadows.soft },
  buttonDisabled: { opacity: 0.6 },
  takenButton: { backgroundColor: THEME.colors.primary },
  skipButton: { backgroundColor: THEME.colors.danger },
  buttonText: { color: THEME.colors.white, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  // Hydration Styles
  hydrationCard: {
    backgroundColor: THEME.colors.white,
    padding: 20,
    borderRadius: THEME.borderRadius.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.soft,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 20
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
  waterButtonText: { color: THEME.colors.white, fontWeight: 'bold', fontSize: 16 },
  vitalBarContainer: { height: 8, borderRadius: 4, width: '100%' },
  vitalBarFill: { height: '100%', borderRadius: 4 }
});

export default PatientDashboardScreen;
