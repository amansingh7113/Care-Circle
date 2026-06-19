import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Sparkles, CheckCircle, AlertTriangle, TrendingUp, Lightbulb, Clock } from 'lucide-react-native';
import { THEME } from '../styles/theme';
import ErrorBoundary from './ErrorBoundary';

const AIInsightsModal = ({ visible, onClose, insights, isLoading, error, onRetry }) => {
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualNotes, setManualNotes] = useState('');

  const renderSection = (title, icon, items, color) => {
    if (!items || items.length === 0) return null;
    const IconComponent = icon;
    return (
      <View style={[styles.section, { borderLeftColor: color }]}>
        <View style={styles.sectionHeader}>
          <IconComponent size={18} color={color} />
          <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        </View>
        {Array.isArray(items) ? items.map((item, idx) => (
          <View key={idx} style={styles.insightItem}>
            <View style={[styles.bullet, { backgroundColor: color }]} />
            <Text style={styles.insightText}>{typeof item === 'string' ? item : JSON.stringify(item)}</Text>
          </View>
        )) : (
          <Text style={styles.insightText}>{typeof items === 'string' ? items : JSON.stringify(items)}</Text>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Sparkles size={48} color={THEME.colors.primary} />
          <Text style={styles.loadingTitle}>Analyzing Prescription...</Text>
          <Text style={styles.loadingSubtitle}>Cross-referencing with your health data</Text>
          <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 20 }} />
        </View>
      );
    }

    if (error || showManualFallback) {
      return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.errorContainer}>
            <Clock size={32} color={THEME.colors.alert} />
            <Text style={styles.errorTitle}>{error || 'Analysis unavailable'}</Text>
            <Text style={styles.errorSubtitle}>You can add your observations manually</Text>
            <TextInput
              style={styles.manualInput}
              multiline
              numberOfLines={4}
              placeholder="Enter your observations about this prescription..."
              placeholderTextColor={THEME.colors.textMuted}
              value={manualNotes}
              onChangeText={setManualNotes}
            />
            {onRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryText}>Retry AI Analysis</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      );
    }

    if (!insights) return null;

    return (
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderSection('What\'s Right', CheckCircle, insights.whats_right, THEME.colors.success)}
        {renderSection('Needs Attention', AlertTriangle, insights.needs_attention, THEME.colors.alert)}
        {renderSection('Health Correlations', TrendingUp, insights.telemetry_correlations, THEME.colors.secondary)}
        {renderSection('Recommendations', Lightbulb, insights.actionable_recommendations, THEME.colors.primary)}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={20} color={THEME.colors.primary} />
              <Text style={styles.headerTitle}>AI Health Insights</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <X size={24} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: THEME.colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 30 },
  handle: { width: 40, height: 4, backgroundColor: THEME.colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { ...THEME.typography.cardTitle, fontSize: 18 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  section: { marginBottom: 20, borderLeftWidth: 3, paddingLeft: 16, paddingVertical: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { ...THEME.typography.cardTitle },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6, marginRight: 10 },
  insightText: { ...THEME.typography.body, flex: 1, lineHeight: 22 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60 },
  loadingTitle: { ...THEME.typography.cardTitle, fontSize: 18, marginTop: 20 },
  loadingSubtitle: { ...THEME.typography.muted, marginTop: 8 },
  errorContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  errorTitle: { ...THEME.typography.cardTitle, marginTop: 16 },
  errorSubtitle: { ...THEME.typography.muted, marginTop: 8, textAlign: 'center' },
  manualInput: { width: '100%', borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, padding: 16, marginTop: 20, ...THEME.typography.body, minHeight: 120, textAlignVertical: 'top' },
  retryButton: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: THEME.colors.primary, borderRadius: THEME.borderRadius.pill },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

});

export default function WrappedAIInsightsModal(props) {
  return (
    <ErrorBoundary>
      <AIInsightsModal {...props} />
    </ErrorBoundary>
  );
}
