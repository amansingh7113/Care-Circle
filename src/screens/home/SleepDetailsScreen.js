import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSleepLogs } from '../../services/sleepApi';
import { useStore } from '../../store/useStore';
import { THEME } from '../../styles/theme';
import EmptyState from '../../components/EmptyState';

const SleepDetailsScreen = ({ navigation }) => {
  const currentCircle = useStore(state => state.currentCircle);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [currentCircle]);

  const fetchLogs = async () => {
    if (!currentCircle?.id) return;
    try {
      setLoading(true);
      const data = await getSleepLogs(currentCircle.id);
      setLogs(data || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch sleep history');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }) => {
    const date = new Date(item.sleep_start).toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    return (
      <View style={styles.card}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{date}</Text>
        </View>
        <View style={styles.contentRow}>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Bedtime</Text>
            <Text style={styles.value}>{formatTime(item.sleep_start)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.timeCol}>
            <Text style={styles.label}>Wake up</Text>
            <Text style={styles.value}>{formatTime(item.sleep_end)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.timeCol}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.valuePrimary}>{formatDuration(item.duration_minutes)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep History</Text>
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
              iconName="moon" 
              titleText="No sleep data" 
              subtitleText="Sleep data will be automatically logged and appear here." 
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: THEME.colors.white, ...THEME.shadows.soft },
  backButton: { marginRight: 16 },
  headerTitle: { ...THEME.typography.header, fontSize: 20 },
  listContainer: { padding: 20 },
  card: { backgroundColor: THEME.colors.white, borderRadius: 16, padding: 20, marginBottom: 16, ...THEME.shadows.medium },
  dateBadge: { backgroundColor: `${THEME.colors.primary}20`, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  dateText: { color: THEME.colors.primary, fontWeight: '700', fontSize: 12 },
  contentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeCol: { alignItems: 'center', flex: 1 },
  label: { color: THEME.colors.textMuted, fontSize: 12, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
  value: { color: THEME.colors.textHeader, fontSize: 16, fontWeight: '700' },
  valuePrimary: { color: THEME.colors.primary, fontSize: 18, fontWeight: '800' },
  divider: { width: 1, height: 30, backgroundColor: THEME.colors.border },
});

export default SleepDetailsScreen;
