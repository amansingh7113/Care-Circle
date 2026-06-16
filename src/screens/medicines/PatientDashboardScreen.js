import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useStore } from '../../store/useStore';
import { getMedicines, logAdministration } from '../../services/medicineApi';
import { THEME } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '../../components/EmptyState';

const PatientDashboardScreen = ({ navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState(null);

  useEffect(() => {
    fetchPendingMedicines();
  }, [currentCircle]);

  const fetchPendingMedicines = async () => {
    if (!currentCircle?.id) return;
    try {
      setLoading(true);
      const data = await getMedicines(currentCircle.id);
      // Filter for medicines that need to be taken today
      // For simplicity in MVP, we show all active medicines that are not marked 'taken' for their next slot
      // Or we just show all medicines and let them log. Let's show active ones.
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
      const scheduledTime = medicine.instructions?.scheduled_times ? medicine.instructions.scheduled_times[0] : null;
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

  const renderItem = ({ item }) => {
    const scheduledTime = item.instructions?.scheduled_times ? item.instructions.scheduled_times.join(', ') : 'As needed';
    
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
        <Text style={styles.headerGreeting}>Hi, {user?.name || 'Patient'}</Text>
        <Text style={styles.headerSubtitle}>Here are your medicines for today</Text>
        <TouchableOpacity style={styles.settingsIcon} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color={THEME.colors.primary} />
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
            ListEmptyComponent={
              <EmptyState 
                icon="medkit" 
                title="All caught up!" 
                message="You have no pending medicines at the moment." 
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { padding: 20, paddingTop: 40, backgroundColor: THEME.colors.white, ...THEME.shadows.soft, marginBottom: 10 },
  headerGreeting: { ...THEME.typography.header, fontSize: 28, color: THEME.colors.primary, marginBottom: 4 },
  headerSubtitle: { ...THEME.typography.body, color: THEME.colors.textMuted },
  settingsIcon: { position: 'absolute', right: 20, top: 45, padding: 8 },
  container: { flex: 1 },
  listContent: { padding: 16 },
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
  buttonText: { color: THEME.colors.white, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }
});

export default PatientDashboardScreen;
