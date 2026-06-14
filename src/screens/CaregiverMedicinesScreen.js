import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useStore } from '../store/useStore';
import { THEME } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import SkeletonLoader from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

const CaregiverMedicinesScreen = ({ navigation }) => {
  const currentCircle = useStore((state) => state.currentCircle);
  const medicineAnalytics = useStore((state) => state.medicineAnalytics);
  const analyticsLoading = useStore((state) => state.analyticsLoading);
  const fetchMedicineAnalytics = useStore((state) => state.fetchMedicineAnalytics);

  useEffect(() => {
    if (currentCircle?.id) {
      fetchMedicineAnalytics();
    }
  }, [currentCircle?.id, fetchMedicineAnalytics]);

  const onRefresh = () => {
    if (currentCircle?.id) {
      fetchMedicineAnalytics();
    }
  };

  const getStatusColor = (statusText) => {
    switch (statusText) {
      case 'Excellent': return THEME.colors.success || '#34C759';
      case 'Stable': return THEME.colors.warning || '#FF9500';
      case 'Attention Needed': return THEME.colors.alert || '#FF3B30';
      default: return THEME.colors.textMuted;
    }
  };

  const renderSummaryCard = () => {
    if (!medicineAnalytics || typeof medicineAnalytics.adherence_rate_7d === 'undefined') return null;
    
    const { adherence_rate_7d, adherence_rate_30d, status, total_taken, total_missed } = medicineAnalytics;
    const statusColor = getStatusColor(status);

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Adherence Rate (7 Days)</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{status}</Text>
          </View>
        </View>
        <Text style={styles.adherencePercentage}>{adherence_rate_7d}%</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Taken Doses</Text>
            <Text style={styles.statValue}>{total_taken}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Missed</Text>
            <Text style={[styles.statValue, { color: THEME.colors.alert }]}>{total_missed}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderThirtyDayCard = () => {
    if (!medicineAnalytics || typeof medicineAnalytics.adherence_rate_30d === 'undefined') return null;
    
    const { adherence_rate_30d } = medicineAnalytics;
    
    return (
      <View style={[styles.summaryCard, { marginTop: 16, padding: 20 }]}>
        <Text style={styles.summaryTitle}>30-Day Trend</Text>
        <Text style={[styles.adherencePercentage, { fontSize: 32, marginTop: 8, marginBottom: 0 }]}>
          {adherence_rate_30d}%
        </Text>
        <Text style={styles.statLabel}>Monthly Adherence</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>ADHERENCE ANALYTICS</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MedicineDashboardScreen')}>
          <Ionicons name="list-outline" size={28} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={analyticsLoading} onRefresh={onRefresh} tintColor={THEME.colors.primary} />}
      >
        {analyticsLoading && !medicineAnalytics ? (
          <>
            <SkeletonLoader style={{ height: 180 }} />
            <SkeletonLoader style={{ height: 120 }} />
          </>
        ) : (
          <>
            {renderSummaryCard()}
            {renderThirtyDayCard()}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { marginBottom: 24, marginTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  header: { ...THEME.typography.header, color: THEME.colors.textHeader, fontSize: 24, letterSpacing: 0 },
  summaryCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 24,
    marginBottom: 32,
    ...THEME.shadows.medium,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    ...THEME.typography.body,
    fontSize: 16,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  adherencePercentage: {
    ...THEME.typography.header,
    fontSize: 48,
    color: THEME.colors.textHeader,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: 16,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    ...THEME.typography.subtext,
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  statValue: {
    ...THEME.typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textHeader,
  },
  alertsSection: {
    flex: 1,
  },
  sectionTitle: {
    ...THEME.typography.header,
    fontSize: 20,
    marginBottom: 16,
  },
  alertCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...THEME.shadows.soft,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${THEME.colors.alert}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  alertInfo: {
    flex: 1,
  },
  alertMedName: {
    ...THEME.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textHeader,
    marginBottom: 4,
  },
  alertTime: {
    ...THEME.typography.subtext,
    color: THEME.colors.textMuted,
  },
  alertActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.button,
  },
  alertActionText: {
    color: THEME.colors.primary,
    fontWeight: '600',
  },
});

export default CaregiverMedicinesScreen;
