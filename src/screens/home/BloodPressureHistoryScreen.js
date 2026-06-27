import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getVitals, deleteVitals, updateVitals } from '../../services/vitalsApi';
import { useStore } from '../../store/useStore';
import { THEME } from '../../styles/theme';
import EmptyState from '../../components/EmptyState';

import LogBloodPressureModal from './LogBloodPressureModal';

const BloodPressureHistoryScreen = ({ navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Add Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [editSystolic, setEditSystolic] = useState('');
  const [editDiastolic, setEditDiastolic] = useState('');
  const [editPulse, setEditPulse] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [currentCircle]);

  const fetchLogs = async () => {
    if (!currentCircle?.id) return;
    try {
      setLoading(true);
      const data = await getVitals(currentCircle.id);
      setLogs(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch blood pressure history');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (log) => {
    setSelectedLog(log);
    setEditSystolic(log.systolic?.toString() || '');
    setEditDiastolic(log.diastolic?.toString() || '');
    setEditPulse(log.pulse?.toString() || '');
    setEditModalVisible(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this log?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVitals(id);
            setLogs(logs.filter(log => log.id !== id));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete log');
          }
        }
      }
    ]);
  };

  const saveEdit = async () => {
    if (!editSystolic || !editDiastolic) {
      return Alert.alert('Error', 'Systolic and Diastolic are required');
    }
    
    try {
      setIsSaving(true);
      const payload = {
        systolic: parseInt(editSystolic, 10),
        diastolic: parseInt(editDiastolic, 10),
        pulse: editPulse ? parseInt(editPulse, 10) : null
      };
      
      const updatedLog = await updateVitals(selectedLog.id, payload);
      setLogs(logs.map(l => l.id === selectedLog.id ? updatedLog : l));
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update log');
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = ({ item }) => {
    const date = new Date(item.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.dateText}>{date}</Text>
          <View style={styles.readingRow}>
            <Text style={styles.readingValue}>{item.systolic}/{item.diastolic}</Text>
            <Text style={styles.readingUnit}> mmHg</Text>
          </View>
          {item.pulse && (
            <Text style={styles.pulseText}>Pulse: {item.pulse} bpm</Text>
          )}
        </View>
        <View style={styles.cardRight}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconButton}>
            <Ionicons name="pencil" size={20} color={THEME.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconButton}>
            <Ionicons name="trash" size={20} color={THEME.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blood Pressure History</Text>
        </View>
        <TouchableOpacity testID="add-bp-button" style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={28} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <EmptyState 
              iconName="heart" 
              titleText="No records yet" 
              subtitleText="Tap the + icon to log your blood pressure." 
            />
          }
        />
      )}

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Reading</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeButton}>
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Systolic</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={editSystolic}
                      onChangeText={setEditSystolic}
                    />
                  </View>
                  <Text style={styles.slash}>/</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Diastolic</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={editDiastolic}
                      onChangeText={setEditDiastolic}
                    />
                  </View>
                </View>

                <View style={styles.inputContainerFull}>
                  <Text style={styles.label}>Pulse (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editPulse}
                    onChangeText={setEditPulse}
                  />
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={saveEdit} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <LogBloodPressureModal 
        visible={addModalVisible} 
        onClose={() => {
          setAddModalVisible(false);
          fetchLogs(); // refresh after add
        }} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 40, backgroundColor: THEME.colors.white, ...THEME.shadows.soft },
  backButton: { marginRight: 16 },
  headerTitle: { ...THEME.typography.header, fontSize: 20 },
  listContainer: { padding: 20 },
  card: { backgroundColor: THEME.colors.white, borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...THEME.shadows.soft },
  cardLeft: { flex: 1 },
  dateText: { color: THEME.colors.textMuted, fontSize: 12, marginBottom: 4 },
  readingRow: { flexDirection: 'row', alignItems: 'baseline' },
  readingValue: { fontSize: 24, fontWeight: 'bold', color: THEME.colors.primary },
  readingUnit: { fontSize: 14, color: THEME.colors.textMuted },
  pulseText: { fontSize: 14, color: THEME.colors.textBody, marginTop: 4 },
  cardRight: { flexDirection: 'row' },
  iconButton: { padding: 8, marginLeft: 8 },
  
  // Modal styles
  modalSafeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { ...THEME.typography.header, fontSize: 24 },
  closeButton: { padding: 8 },
  closeText: { color: THEME.colors.primary, fontWeight: '600', fontSize: 16 },
  modalContent: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  inputContainer: { flex: 1 },
  inputContainerFull: { marginBottom: 30 },
  label: { ...THEME.typography.label, marginBottom: 8, color: THEME.colors.textBody },
  input: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.badge,
    padding: 16,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  slash: { fontSize: 32, fontWeight: '300', color: THEME.colors.textMuted, marginHorizontal: 10, marginTop: 20 },
  saveButton: {
    backgroundColor: THEME.colors.success,
    padding: 16,
    borderRadius: THEME.borderRadius.badge,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 40,
  },
  saveButtonText: { color: THEME.colors.white, fontSize: 18, fontWeight: 'bold' },
});

export default BloodPressureHistoryScreen;
