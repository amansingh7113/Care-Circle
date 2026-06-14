import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, SafeAreaView, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { logVitals } from '../../services/vitalsApi';
import { useStore } from '../../store/useStore';
import { THEME } from '../../styles/theme';

const LogBloodPressureModal = ({ visible, onClose }) => {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageUri, setImageUri] = useState(null);

  const { currentCircle, addBloodPressureLog } = useStore();

  const handleScanMonitor = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        let uri = result.assets[0].uri;
        
        if (Platform.OS === 'android' && !uri.startsWith('file://')) {
          uri = `file://${uri}`;
        }

        setIsProcessing(true);
        setImageUri(uri);
        
        if (!TextRecognition || !TextRecognition.recognize) {
          throw new Error("ML Kit native module is not linked. Did you run 'npx expo run:android'?");
        }

        // Process image with ML Kit Text Recognition
        const recognizedText = await TextRecognition.recognize(uri);
        
        // Parse lines instead of just blocks to avoid merging multi-line numbers
        // e.g. "131\n86\n82" becoming "1318682"
        const blocks = recognizedText.blocks;
        const numbers = [];
        
        blocks.forEach(block => {
            const lines = block.lines && block.lines.length > 0 
                ? block.lines 
                : block.text.split('\n').map(t => ({ text: t, frame: block.frame }));
                
            lines.forEach(line => {
                // Digital 7-segment displays often cause OCR to insert spaces, e.g. "1 3 1"
                // So we strip all non-digits from the line before parsing
                const cleanedText = line.text.replace(/[^0-9]/g, '');
                if (cleanedText) {
                    const num = parseInt(cleanedText, 10);
                    if (num >= 30 && num <= 300) {
                        numbers.push({ 
                            value: num, 
                            top: line.frame?.top || block.frame?.top || 0,
                            height: line.frame?.height || block.frame?.height || 0
                        });
                    }
                }
            });
        });

        // BP monitor numbers are typically the largest text on the screen.
        // Sort by bounding box height descending to prioritize main readings.
        numbers.sort((a, b) => b.height - a.height);

        // Take up to top 3 largest numbers
        const mainNumbers = numbers.slice(0, 3);

        // Sort them vertically (top to bottom usually maps to Sys, Dia, Pulse)
        mainNumbers.sort((a, b) => a.top - b.top);

        if (mainNumbers.length >= 2) {
            setSystolic(mainNumbers[0].value.toString());
            setDiastolic(mainNumbers[1].value.toString());
            if (mainNumbers.length >= 3) {
                setPulse(mainNumbers[2].value.toString());
            }
            Alert.alert('Success', 'Extracted values from image. Please verify they are correct before saving.');
        } else {
            Alert.alert('Could not detect', 'We couldn\'t reliably detect the numbers. Please enter them manually.');
        }
      }
    } catch (error) {
      console.error('BP Scanner OCR Error:', error);
      Alert.alert('Scanner Error', error.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!systolic || !diastolic) {
      Alert.alert('Validation Error', 'Please enter both Systolic and Diastolic values.');
      return;
    }

    try {
      setIsProcessing(true);

      const logData = {
        circle_id: currentCircle?.id,
        systolic: parseInt(systolic, 10),
        diastolic: parseInt(diastolic, 10),
        pulse: pulse ? parseInt(pulse, 10) : null,
      };

      const data = await logVitals(logData);

      addBloodPressureLog(data);
      Alert.alert('Saved', 'Blood pressure logged successfully!');
      
      // Reset and close
      setSystolic('');
      setDiastolic('');
      setPulse('');
      setImageUri(null);
      onClose();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save log to database.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Log Blood Pressure</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <TouchableOpacity style={styles.scanButton} onPress={handleScanMonitor} disabled={isProcessing}>
              <Text style={styles.scanButtonText}>📷 Scan Monitor Display</Text>
            </TouchableOpacity>
            
            <Text style={styles.orText}>- OR MANUAL ENTRY -</Text>

            {imageUri && (
                <Image source={{uri: imageUri}} style={styles.previewImage} resizeMode="contain" />
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Systolic (SYS)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="120"
                  value={systolic}
                  onChangeText={setSystolic}
                />
              </View>
              <Text style={styles.slash}>/</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Diastolic (DIA)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="80"
                  value={diastolic}
                  onChangeText={setDiastolic}
                />
              </View>
            </View>

            <View style={styles.inputContainerFull}>
              <Text style={styles.label}>Pulse (Optional)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="72"
                value={pulse}
                onChangeText={setPulse}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Save Log</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  headerTitle: { ...THEME.typography.header, fontSize: 24 },
  closeButton: { padding: 8 },
  closeText: { color: THEME.colors.primary, fontWeight: '600', fontSize: 16 },
  content: { flex: 1 },
  scanButton: {
    backgroundColor: THEME.colors.primary,
    padding: 16,
    borderRadius: THEME.borderRadius.badge,
    alignItems: 'center',
    marginBottom: 20,
    ...THEME.shadows.soft,
  },
  scanButtonText: { color: THEME.colors.white, fontSize: 16, fontWeight: '700' },
  orText: { textAlign: 'center', color: THEME.colors.textMuted, marginBottom: 20, fontSize: 12, fontWeight: '600' },
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
  previewImage: { width: '100%', height: 120, marginBottom: 20, borderRadius: 8 }
});

export default LogBloodPressureModal;
