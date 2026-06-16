import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, FlatList, TextInput } from 'react-native';
import { Mic, MicOff, Check, X, AlertCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { THEME } from '../styles/theme';
import { logVoiceMedicine } from '../services/medicineApi';

const VoiceLogButton = ({ circleId, onSuccess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showTranscriptInput, setShowTranscriptInput] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission required');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording');
      console.error(err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setIsProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      setRecording(null);
      
      // Fallback to manual transcription for MVP
      setShowTranscriptInput(true);
    } catch (err) {
      setError(err.message || 'Failed to process voice log');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitTranscript = async () => {
    if (!transcriptText.trim()) return;
    setShowTranscriptInput(false);
    setIsProcessing(true);
    try {
      const response = await logVoiceMedicine(circleId, transcriptText.trim());
      setResults(response);
      setShowResults(true);
      setTranscriptText('');
      if (onSuccess) onSuccess();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to process voice log';
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Start recording
      startRecording();
    }
  };

  return (
    <>
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[styles.fab, isRecording && styles.fabRecording, isProcessing && styles.fabProcessing]}
          onPress={handlePress}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <Text style={styles.fabProcessingText}>...</Text>
          ) : isRecording ? (
            <MicOff size={26} color="#fff" />
          ) : (
            <Mic size={26} color="#fff" />
          )}
        </TouchableOpacity>
        {!isProcessing && !isRecording && (
          <Text style={styles.fabLabel}>Voice Log</Text>
        )}
      </Animated.View>

      {/* Transcript Input Modal */}
      <Modal visible={showTranscriptInput} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.transcriptModal}>
            <View style={styles.transcriptHeader}>
              <Mic size={20} color={THEME.colors.primary} />
              <Text style={styles.transcriptTitle}>Voice Medicine Log</Text>
              <TouchableOpacity onPress={() => setShowTranscriptInput(false)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <X size={22} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.transcriptHint}>Describe which medicines you took, e.g. "I took my morning Metformin and Amlodipine"</Text>
            
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  multiline
                  placeholder="Type what you took..."
                  placeholderTextColor={THEME.colors.textMuted}
                  value={transcriptText}
                  onChangeText={setTranscriptText}
                />
              </View>
              <TouchableOpacity
                style={[styles.submitButton, !transcriptText.trim() && styles.submitDisabled]}
                onPress={submitTranscript}
                disabled={!transcriptText.trim()}
              >
                <Check size={20} color="#fff" />
                <Text style={styles.submitText}>Process with AI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Results Modal */}
      <Modal visible={showResults} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.resultsModal}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Voice Log Results</Text>
              <TouchableOpacity onPress={() => { setShowResults(false); setResults(null); }} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <X size={22} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            {results?.message && (
              <View style={styles.resultItem}>
                <View style={[styles.resultIcon, { backgroundColor: (THEME.colors.success || '#34C759') + '20' }]}>
                  <Check size={16} color={THEME.colors.success || '#34C759'} />
                </View>
                <View style={styles.resultContent}>
                  <Text style={styles.resultMedicine}>{results.message}</Text>
                </View>
              </View>
            )}
            {results?.logged && results.logged.length > 0 && (
              <Text style={styles.processedCount}>{results.logged.length} medicine(s) logged successfully</Text>
            )}
            {results?.logged && results.logged.length === 0 && (
              <Text style={styles.processedCount}>No medicines were matched</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Error Toast */}
      {error && (
        <View style={styles.errorToast}>
          <AlertCircle size={16} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <X size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: { position: 'absolute', bottom: 24, right: 20, alignItems: 'center', zIndex: 100 },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: THEME.colors.primary, justifyContent: 'center', alignItems: 'center', ...THEME.shadows.soft, elevation: 6 },
  fabRecording: { backgroundColor: THEME.colors.alert },
  fabProcessing: { backgroundColor: THEME.colors.textMuted },
  fabLabel: { ...THEME.typography.muted, fontSize: 10, marginTop: 4, fontWeight: '700' },
  fabProcessingText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  transcriptModal: { backgroundColor: THEME.colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20 },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  transcriptTitle: { ...THEME.typography.cardTitle, fontSize: 18, flex: 1, marginLeft: 10 },
  transcriptHint: { ...THEME.typography.muted, paddingHorizontal: 20, marginBottom: 16, lineHeight: 20 },
  inputContainer: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  textInput: { ...THEME.typography.body, minHeight: 80, textAlignVertical: 'top' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: THEME.colors.primary, paddingVertical: 16, borderRadius: THEME.borderRadius.pill },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultsModal: { backgroundColor: THEME.colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  resultsTitle: { ...THEME.typography.cardTitle, fontSize: 18 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  resultIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  resultContent: { flex: 1 },
  resultMedicine: { ...THEME.typography.cardTitle },
  resultMessage: { ...THEME.typography.muted, marginTop: 2 },
  processedCount: { ...THEME.typography.muted, textAlign: 'center', marginTop: 16 },
  errorToast: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: THEME.colors.alert, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 200 },
  errorText: { color: '#fff', flex: 1, fontSize: 13, fontWeight: '600' }
});

export default VoiceLogButton;
