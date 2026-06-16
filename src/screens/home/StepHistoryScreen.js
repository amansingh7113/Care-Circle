import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSteps } from '../../services/stepApi';
import { useStore } from '../../store/useStore';
import { THEME } from '../../styles/theme';
import EmptyState from '../../components/EmptyState';
import SkeletonLoader from '../../components/SkeletonLoader';

const StepHistoryScreen = ({ navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7); // 7 or 30 days

  useEffect(() => {
    fetchLogs();
  }, [currentCircle, period]);

  const fetchLogs = async () => {
    if (!currentCircle?.id) return;
    try {
      setLoading(true);
      const data = await getSteps(currentCircle.id, period);
      setLogs(data || []);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Failed to fetch step history');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getStepColor = (count) => {
    if (count >= 10000) return '#34A853'; // Green
    if (count >= 5000) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const renderItem = ({ item }) => {
    const dateObj = new Date(item.date);
    const dateLabel = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const progress = Math.min((item.step_count / 10000) * 100, 100);
    const color = getStepColor(item.step_count);
    
    return (
      <View style={styles.card}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>
        <View style={styles.contentRow}>
          <View style={styles.statsContainer}>
            <Text style={styles.label}>Steps</Text>
            <Text style={[styles.valuePrimary, { color }]}>{item.step_count.toLocaleString()}</Text>
          </View>
          <View style={styles.chartContainer}>
            <View style={styles.barBackground}>
              <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.goalText}>Goal: 10k</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step History</Text>
      </View>

      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, period === 7 && styles.toggleBtnActive]}
          onPress={() => setPeriod(7)}
        >
          <Text style={[styles.toggleText, period === 7 && styles.toggleTextActive]}>7 Days</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleBtn, period === 30 && styles.toggleBtnActive]}
          onPress={() => setPeriod(30)}
        >
          <Text style={[styles.toggleText, period === 30 && styles.toggleTextActive]}>30 Days</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{padding: 20}}>
          <SkeletonLoader />
          <SkeletonLoader />
          <SkeletonLoader />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState 
              iconName="footsteps" 
              titleText="No step data" 
              subtitleText="Step data will be automatically logged and appear here." 
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: THEME.colors.deepNavy, ...THEME.shadows.soft },
  backButton: { marginRight: 16 },
  headerTitle: { ...THEME.typography.header, fontSize: 20, color: THEME.colors.white },
  toggleContainer: { 
    flexDirection: 'row', padding: 4, margin: 20, 
    backgroundColor: THEME.colors.surface, borderRadius: 12 
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: THEME.colors.primary, ...THEME.shadows.soft },
  toggleText: { fontWeight: '600', color: THEME.colors.textMuted },
  toggleTextActive: { color: THEME.colors.white },
  listContainer: { padding: 20, paddingTop: 0 },
  card: { backgroundColor: THEME.colors.white, borderRadius: 16, padding: 20, marginBottom: 16, ...THEME.shadows.medium },
  dateBadge: { backgroundColor: `${THEME.colors.primary}15`, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16 },
  dateText: { color: THEME.colors.primary, fontWeight: '700', fontSize: 13 },
  contentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsContainer: { flex: 1 },
  label: { color: THEME.colors.textMuted, fontSize: 12, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
  valuePrimary: { fontSize: 24, fontWeight: '800' },
  chartContainer: { flex: 2, alignItems: 'flex-end', justifyContent: 'center' },
  barBackground: { height: 12, backgroundColor: THEME.colors.surface, borderRadius: 6, width: '100%', marginBottom: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  goalText: { fontSize: 11, color: THEME.colors.textMuted, fontWeight: '500' }
});

export default StepHistoryScreen;
