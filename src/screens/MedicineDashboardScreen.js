import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMedicines, logAdministration } from '../services/medicineApi';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import { THEME } from '../styles/theme';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import { Ionicons } from '@expo/vector-icons';

const MedicineDashboardScreen = ({ route, navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const circleId = route.params?.circleId || currentCircle?.id;
  const [medicines, setMedicines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchMedicines();
    }, [circleId])
  );

  const fetchMedicines = async () => {
    if (!circleId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getMedicines(circleId);
      setMedicines(data.medicines || data || []);
    } catch (error) {
      console.log('Failed to fetch medicines', error);
      // Fallback mock data for UI testing if API fails
      setMedicines([
        { id: '1', name: 'Amoxicillin', dosage: '500mg', time: '08:00 AM', status: 'pending' },
        { id: '2', name: 'Lisinopril', dosage: '10mg', time: '12:00 PM', status: 'pending' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLog = async (id, status) => {
    // Optimistic update
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    try {
      await logAdministration(id, status);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `Medicine marked as ${status}`);
    } catch (error) {
      console.log('Failed to log administration', error);
    }
  };

  const renderMedicine = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.medName}>{item.name}</Text>
        <Text style={styles.medDetails}>{item.dosage} at {item.time || (item.instructions?.scheduled_times ? item.instructions.scheduled_times.join(', ') : 'Scheduled')}</Text>
      </View>
      <View style={styles.actions}>
        {item.status === 'taken' || item.status === 'skipped' ? (
          <Text style={[styles.btnText, { color: item.status === 'taken' ? '#34A853' : '#EA4335', padding: 8 }]}>
            {item.status === 'taken' ? 'Taken' : 'Skipped'}
          </Text>
        ) : (
          <>
            <TouchableOpacity style={[styles.actionBtn, styles.takenBtn]} onPress={() => handleLog(item.id, 'taken')}>
              <Text style={styles.btnText}>Taken</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.skipBtn]} onPress={() => handleLog(item.id, 'skipped')}>
              <Text style={styles.btnText}>Skip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader />
        <SkeletonLoader />
        <SkeletonLoader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.header}>Medicine Tracker</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddMedicine', { circleId })}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      
      {medicines.length === 0 ? (
        <EmptyState 
          iconName="medical-outline" 
          titleText="No Medicines Today" 
          subtitleText="You have no scheduled medicines for today."
        />
      ) : (
        <FlatList
          data={medicines}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMedicine}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 40 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 8, marginLeft: -8, marginRight: 8 },
  header: { ...THEME.typography.header, color: THEME.colors.primary },
  addBtn: { backgroundColor: THEME.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: THEME.colors.cardBg, fontWeight: 'bold' },
  list: { paddingBottom: 20 },
  card: { backgroundColor: THEME.colors.cardBg, padding: 16, borderRadius: THEME.borderRadius.card, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...THEME.shadows.soft, borderWidth: 1, borderColor: THEME.colors.border },
  cardInfo: { flex: 1 },
  medName: { ...THEME.typography.cardTitle },
  medDetails: { ...THEME.typography.body, color: THEME.colors.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  takenBtn: { backgroundColor: THEME.colors.success },
  skipBtn: { backgroundColor: THEME.colors.alert },
  btnText: { color: THEME.colors.cardBg, fontSize: 14, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: THEME.colors.textMuted, fontSize: 16 }
});

export default MedicineDashboardScreen;
