import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Platform, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { COMMON_MEDICINES } from '../utils/commonMedicines';
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
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    unit: 'mg',
    scheduled_times: [],
    stock_quantity: '30'
  });

  useFocusEffect(
    useCallback(() => {
      fetchMedicines();
    }, [circleId])
  );

  const handleNameChange = (text) => {
    setFormData({ ...formData, name: text });
    if (text.length > 0) {
      const filtered = COMMON_MEDICINES.filter(med => med.toLowerCase().includes(text.toLowerCase()));
      setFilteredMedicines(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (name) => {
    setFormData({ ...formData, name });
    setShowSuggestions(false);
  };

  const handleScanMedicine = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to scan medicine strips.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setIsSubmitting(true);
        
        const recognizedText = await TextRecognition.recognize(uri);
        const textBlocks = recognizedText.blocks.map(b => b.text).join(' ');

        let foundName = '';
        for (const med of COMMON_MEDICINES) {
          if (textBlocks.toLowerCase().includes(med.toLowerCase())) {
            foundName = med;
            break;
          }
        }

        const dosageMatch = textBlocks.match(/(\d+)\s*(mg|ml)/i);
        let foundDosage = '';
        let foundUnit = 'mg';
        if (dosageMatch) {
          foundDosage = dosageMatch[1];
          foundUnit = dosageMatch[2].toLowerCase();
        }

        if (foundName || foundDosage) {
          setFormData(prev => ({
            ...prev,
            name: foundName || prev.name,
            dosage: foundDosage || prev.dosage,
            unit: foundUnit
          }));
          Alert.alert('Scan Complete', `Extracted: ${foundName || 'Unknown Name'} ${foundDosage}${foundUnit}`);
        } else {
          Alert.alert('Scan Complete', 'Could not clearly identify a medicine name or dosage.');
        }
      }
    } catch (error) {
      console.log('OCR Error', error);
      Alert.alert('Error', 'Failed to process image text.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    const previousMedicines = [...medicines];
    setMedicines(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    try {
      await logAdministration(id, status);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log('Failed to log administration', error);
      Alert.alert('Error', 'Failed to update medicine status.');
      setMedicines(previousMedicines); // Revert optimistic update
    }
  };

  const handleAddMedicine = async () => {
    if (!formData.name || !formData.dosage || formData.scheduled_times.length === 0) {
      Alert.alert('Error', 'Please fill in all required fields and add at least one scheduled time.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const stock = parseInt(formData.stock_quantity) || 30;
      // Automate refill threshold (20% of stock, or minimum 5)
      const automatedRefillThreshold = Math.max(5, Math.floor(stock * 0.2));

      const payload = {
        name: formData.name,
        dosage: `${formData.dosage}${formData.unit !== 'pills' ? formData.unit : ''}`.trim(),
        instructions: {
          scheduled_times: formData.scheduled_times,
        },
        stock_quantity: stock,
        refill_alert_threshold: automatedRefillThreshold
      };

      const newMed = await addMedicine(circleId, payload);
      setMedicines(prev => [...prev, newMed.medicine || newMed]);
      setModalVisible(false);
      setFormData({ name: '', dosage: '', unit: 'mg', scheduled_times: [], stock_quantity: '30' });
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
          <Text style={styles.medDetails}>Completed</Text>
          <View style={styles.takenBadgeRow}>
            <Ionicons name="checkmark-circle" size={20} color={THEME.colors.primary} />
            <Text style={styles.takenBadgeText}>Taken</Text>
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
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Add New Medicine</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.inputGroup, { zIndex: 10 }]}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>Medicine Name</Text>
                  <TouchableOpacity onPress={handleScanMedicine} style={{flexDirection: 'row', alignItems: 'center', padding: 4}}>
                     <Ionicons name="camera" size={16} color={THEME.colors.primary} />
                     <Text style={{color: THEME.colors.primary, fontSize: 12, marginLeft: 4, fontWeight: 'bold'}}>SCAN STRIP</Text>
                  </TouchableOpacity>
                </View>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Aspirin" 
                  placeholderTextColor={THEME.colors.textMuted}
                  value={formData.name} 
                  onChangeText={handleNameChange}
                  onFocus={() => {
                    if (formData.name.length > 0) setShowSuggestions(true);
                  }}
                />
                {showSuggestions && filteredMedicines.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                      {filteredMedicines.map((med, idx) => (
                        <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(med)}>
                          <Text style={styles.suggestionText}>{med}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.rowGroup}>
                <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
                  <Text style={styles.label}>Amount</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="e.g. 10" 
                    keyboardType="numeric"
                    placeholderTextColor={THEME.colors.textMuted}
                    value={formData.dosage} 
                    onChangeText={(text) => setFormData({ ...formData, dosage: text })} 
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Unit</Text>
                  <TouchableOpacity 
                    style={styles.unitBtn}
                    onPress={() => {
                       const units = ['mg', 'ml', 'pills'];
                       const currentIdx = units.indexOf(formData.unit);
                       const nextUnit = units[(currentIdx + 1) % units.length];
                       setFormData({ ...formData, unit: nextUnit });
                    }}
                  >
                    <Text style={styles.unitBtnText}>{formData.unit}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Scheduled Times</Text>
                <View style={styles.timesContainer}>
                  {formData.scheduled_times.map((t, idx) => (
                    <View key={idx} style={styles.timeTag}>
                      <Text style={styles.timeTagText}>{t}</Text>
                      <TouchableOpacity onPress={() => {
                        setFormData(prev => ({
                          ...prev,
                          scheduled_times: prev.scheduled_times.filter((_, i) => i !== idx)
                        }));
                      }}>
                        <Ionicons name="close-circle" size={20} color={THEME.colors.white} style={{marginLeft: 6}} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addTimeBtn} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={20} color={THEME.colors.primary} />
                    <Text style={styles.addTimeBtnText}>Add Time</Text>
                  </TouchableOpacity>
                </View>
                
                {showTimePicker && (
                  <DateTimePicker
                    value={new Date()}
                    mode="time"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (event.type === 'set' && selectedDate) {
                        const hours = selectedDate.getHours().toString().padStart(2, '0');
                        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                        const timeStr = `${hours}:${minutes}`;
                        if (!formData.scheduled_times.includes(timeStr)) {
                          setFormData(prev => ({
                            ...prev,
                            scheduled_times: [...prev.scheduled_times, timeStr].sort()
                          }));
                        }
                      } else {
                        setShowTimePicker(false);
                      }
                    }}
                  />
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Stock (Number of Pills/Units)</Text>
                <TextInput 
                  style={styles.input} 
                  keyboardType="numeric"
                  placeholder="e.g. 30" 
                  placeholderTextColor={THEME.colors.textMuted}
                  value={formData.stock_quantity} 
                  onChangeText={(text) => setFormData({ ...formData, stock_quantity: text })} 
                />
              </View>

            </ScrollView>

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
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between' },
  unitBtn: {
    borderWidth: 1, borderColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.input,
    padding: 14, alignItems: 'center', backgroundColor: `${THEME.colors.primary}10`
  },
  unitBtnText: { color: THEME.colors.primary, fontWeight: 'bold', fontSize: 16 },
  timesContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  timeTag: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: THEME.colors.primary, 
    paddingHorizontal: 12, paddingVertical: 8, 
    borderRadius: 20, marginRight: 8, marginBottom: 8 
  },
  timeTagText: { color: THEME.colors.white, fontWeight: '600' },
  addTimeBtn: { 
    flexDirection: 'row', alignItems: 'center', 
    borderWidth: 1, borderColor: THEME.colors.primary, borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 8, 
    borderRadius: 20, marginBottom: 8 
  },
  addTimeBtnText: { color: THEME.colors.primary, fontWeight: '600', marginLeft: 4 },
  suggestionsContainer: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1, borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.input,
    maxHeight: 150,
    position: 'absolute', top: 75, left: 0, right: 0, zIndex: 10,
    ...THEME.shadows.soft
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border
  },
  suggestionText: { color: THEME.colors.textHeader, fontSize: 16 },
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

