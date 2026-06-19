import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, TextInput, ScrollView } from 'react-native';
import { Mic, MicOff, Check, X, AlertCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { THEME } from '../styles/theme';
import { logVoiceMedicine, logVoiceMedicineAudio, logAdministration } from '../services/medicineApi';
import ErrorBoundary from './ErrorBoundary';

const VoiceLogButton = ({ circleId, onSuccess }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  
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
    if (isProcessing) return;
    setIsProcessing(true);
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
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = async () => {
    if (!recording || isProcessing) return;
    setIsProcessing(true);
    setIsRecording(false);

    try {
      const uri = recording.getURI();
      await recording.stopAndUnloadAsync();
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      
      setRecording(null);
      
      if (uri) {
        const response = await logVoiceMedicineAudio(circleId, uri);
        if (response.parsedData && response.parsedData.length > 0) {
          setParsedItems(response.parsedData);
          setShowConfirmation(true);
        } else {
          setError('No medicines were matched in the voice log');
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to process voice log';
      setError(errorMsg);
      console.error(err);
      setRecording(null); 
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
      if (response.parsedData && response.parsedData.length > 0) {
        setParsedItems(response.parsedData);
        setShowConfirmation(true);
      } else {
        setError('No medicines were matched in the transcript');
      }
      setTranscriptText('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to process voice log';
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmLogs = async () => {
    setIsProcessing(true);
    try {
      const validItems = parsedItems.filter(item => item.medicine_id);
      
      for (const item of validItems) {
        await logAdministration(item.medicine_id, item.action === 'skipped' ? 'skipped' : 'taken');
      }
      
      setShowConfirmation(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save logs';
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeItem = (index) => {
    const updated = [...parsedItems];
    updated.splice(index, 1);
    setParsedItems(updated);
    if (updated.length === 0) {
      setShowConfirmation(false);
      setError('All items removed.');
    }
  };

  const handlePress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <>
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={[styles.fab, isRecording && styles.fabRecording, isProcessing && styles.fabProcessing]}
          onPress={handlePress}
          onLongPress={() => setShowTranscriptInput(true)}
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

      <Modal visible={showTranscriptInput} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.transcriptModal}>
            <View style={styles.transcriptHeader}>
              <Mic size={20} color={THEME.colors.primary} />
              <Text style={styles.transcriptTitle}>Manual Entry / Transcript</Text>
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

      <Modal visible={showConfirmation} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.resultsModal}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Confirm Voice Logs</Text>
              <TouchableOpacity onPress={() => setShowConfirmation(false)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <X size={22} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
              {parsedItems.map((item, index) => (
                <View key={index} style={styles.parsedItem}>
                  <View style={{flex: 1}}>
                    <Text style={styles.parsedMedicineName}>{item.medicine_name || 'Unknown'}</Text>
                    <Text style={styles.parsedDetail}>
                      Action: <Text style={{fontWeight: '600', color: item.action === 'skipped' ? THEME.colors.alert : THEME.colors.success}}>{item.action}</Text>
                    </Text>
                    {item.dosage ? <Text style={styles.parsedDetail}>Dosage: {item.dosage}</Text> : null}
                    {!item.medicine_id && <Text style={{color: THEME.colors.alert, fontSize: 12, marginTop: 4}}>* Cannot find medicine in circle</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeItem(index)} style={{padding: 8}}>
                    <X size={20} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.submitButton, isProcessing && styles.submitDisabled]} 
              onPress={handleConfirmLogs}
              disabled={isProcessing}
            >
              <Check size={20} color="#fff" />
              <Text style={styles.submitText}>{isProcessing ? 'Saving...' : 'Confirm Logs'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  resultsModal: { backgroundColor: THEME.colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  resultsTitle: { ...THEME.typography.cardTitle, fontSize: 18 },
  parsedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  parsedMedicineName: { ...THEME.typography.cardTitle, fontSize: 16, marginBottom: 4 },
  parsedDetail: { ...THEME.typography.muted, fontSize: 14 },
  errorToast: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: THEME.colors.alert, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 200 },
  errorText: { color: '#fff', flex: 1, fontSize: 13, fontWeight: '600' }
});

});

export default function WrappedVoiceLogButton(props) {
  return (
    <ErrorBoundary>
      <VoiceLogButton {...props} />
    </ErrorBoundary>
  );
}
