import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMedicines, logAdministration, addMedicine } from '../services/medicineApi';
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

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    scheduled_times: '',
  });

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
        { id: '1', name: 'Aspirin 81mg', dosage: '81mg', time: '8:00 AM', shape: 'mepirril', status: 'pending' },
        { id: '2', name: 'Lisinopril 10mg', dosage: '10mg', time: '8:00 AM', shape: 'round', status: 'taken' },
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

  const handleAddMedicine = async () => {
    if (!formData.name || !formData.dosage) {
      Alert.alert('Error', 'Please fill in the medicine name and dosage.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        dosage: formData.dosage,
        instructions: {
          scheduled_times: formData.scheduled_times ? formData.scheduled_times.split(',').map(t => t.trim()) : [],
        },
        stock_quantity: 30,
        refill_alert_threshold: 5
      };

      const newMed = await addMedicine(circleId, payload);
      setMedicines(prev => [...prev, newMed.medicine || newMed]);
      setModalVisible(false);
      setFormData({ name: '', dosage: '', scheduled_times: '' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Medicine added successfully');
      fetchMedicines(); // refresh just in case
    } catch (error) {
      console.log('Failed to add medicine', error);
      Alert.alert('Error', 'Failed to add medicine. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMedicine = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medDetails}>Taken: {item.time || (item.instructions?.scheduled_times ? item.instructions.scheduled_times.join(', ') : 'Scheduled')}</Text>
          {item.shape && <Text style={styles.medDetails}>Shape {item.shape}</Text>}
        </View>
        <View style={styles.pillIconContainer}>
          <Text style={styles.pillIcon}>💊</Text>
        </View>
      </View>
      
      {item.status === 'taken' ? (
        <View style={styles.takenStateContainer}>
          <Text style={styles.medDetails}>Taken</Text>
          <View style={styles.takenBadgeRow}>
            <Ionicons name="checkmark-circle" size={20} color={THEME.colors.primary} />
            <Text style={styles.takenBadgeText}>Mark as Taken</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleLog(item.id, 'taken')}>
          <Text style={styles.btnText}>Mark as Taken</Text>
        </TouchableOpacity>
      )}
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
        <Text style={styles.header}>MEDICINE TRACKER</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={36} color={THEME.colors.primary} />
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
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderMedicine}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <View style={styles.bottomGraphicContainer}>
              <View style={styles.bottlePlaceholder}>
                <Text style={{fontSize: 60}}>💊</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Add Medicine Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Medicine</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medicine Name</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Aspirin" 
                placeholderTextColor={THEME.colors.textMuted}
                value={formData.name} 
                onChangeText={(text) => setFormData({ ...formData, name: text })} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dosage</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 10mg" 
                placeholderTextColor={THEME.colors.textMuted}
                value={formData.dosage} 
                onChangeText={(text) => setFormData({ ...formData, dosage: text })} 
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Scheduled Times (comma separated)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. 8:00 AM, 8:00 PM" 
                placeholderTextColor={THEME.colors.textMuted}
                value={formData.scheduled_times} 
                onChangeText={(text) => setFormData({ ...formData, scheduled_times: text })} 
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={isSubmitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddMedicine} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color={THEME.colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { marginBottom: 24, marginTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { ...THEME.typography.header, color: THEME.colors.textHeader, fontSize: 24, letterSpacing: 0 },
  list: { paddingBottom: 20 },
  card: { 
    backgroundColor: THEME.colors.cardBg, 
    borderRadius: THEME.borderRadius.card, 
    marginBottom: 16, 
    ...THEME.shadows.soft, 
    borderWidth: 1, 
    borderColor: THEME.colors.border,
    overflow: 'hidden'
  },
  cardContent: {
    padding: 20,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  medName: { ...THEME.typography.header, fontSize: 18, marginBottom: 4 },
  medDetails: { ...THEME.typography.body, color: THEME.colors.textMuted },
  pillIconContainer: {
    width: 48, height: 48, borderRadius: 24, 
    backgroundColor: `${THEME.colors.primary}15`, 
    justifyContent: 'center', alignItems: 'center',
    transform: [{ rotate: '45deg' }]
  },
  pillIcon: { fontSize: 24 },
  actionBtn: { 
    backgroundColor: THEME.colors.primary, 
    paddingVertical: 14, 
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: THEME.borderRadius.badge
  },
  btnText: { color: THEME.colors.white, fontSize: 16, fontWeight: '700' },
  takenStateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  takenBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${THEME.colors.primary}20`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.badge,
  },
  takenBadgeText: {
    color: THEME.colors.white,
    fontWeight: '700',
    marginLeft: 8,
  },
  bottomGraphicContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
    height: 150
  },
  bottlePlaceholder: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: `${THEME.colors.alert}20`,
    justifyContent: 'center', alignItems: 'center'
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalTitle: {
    ...THEME.typography.header,
    fontSize: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    ...THEME.typography.subtext,
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.input,
    padding: 14,
    fontSize: 16,
    color: THEME.colors.textHeader,
    backgroundColor: THEME.colors.background,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: THEME.borderRadius.button,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    marginRight: 12,
  },
  cancelBtnText: {
    color: THEME.colors.textMuted,
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtn: {
    flex: 1,
    padding: 16,
    borderRadius: THEME.borderRadius.button,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    color: THEME.colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MedicineDashboardScreen;

