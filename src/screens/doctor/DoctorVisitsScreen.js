import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getDoctorVisits, addDoctorVisit, deleteDoctorVisit, updateDoctorVisit } from '../../services/doctorVisitApi';
import { uploadEncryptedFile, addDocumentMetadata } from '../../services/documentsApi';
import { getDoctorSummary } from '../../services/insightsApi';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AdBanner from '../../components/AdBanner';
import { useStore } from '../../store/useStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../styles/theme';

const PRIMARY_BLUE = THEME.colors.primary;
const TOUCH_TARGET_SIZE = 48;

const DoctorVisitsScreen = ({ navigation }) => {
  const { user, currentCircle } = useStore();
  const circleId = currentCircle?.id || user?.circle_id;
  const insets = useSafeAreaInsets();

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (circleId) {
      fetchVisits();
    }
  }, [circleId]);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const data = await getDoctorVisits(circleId);
      setVisits(data || []);
    } catch (error) {
      console.error('Error fetching doctor visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        setAttachments([...attachments, ...result.assets]);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleGenerateSummary = async () => {
    try {
      setGeneratingSummary(true);
      setSummaryModalVisible(true);
      const data = await getDoctorSummary(circleId);
      setAiSummary(data.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      Alert.alert('Error', 'Failed to generate summary');
      setSummaryModalVisible(false);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const openAddModal = () => {
    setEditingVisitId(null);
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (visit) => {
    setEditingVisitId(visit.id);
    setDoctorName(visit.doctor_name || '');
    setVisitDate(visit.visit_date || '');
    setReason(visit.reason || '');
    setNotes(visit.notes || '');
    setAttachments([]);
    setModalVisible(true);
  };

  const handleSaveVisit = async () => {
    // Basic validation could go here
    if (!doctorName || !visitDate) {
      Alert.alert('Error', 'Please provide at least a Doctor Name and Date');
      return;
    }
    
    try {
      setLoading(true);

      const attachment_urls = [];
      const uploadedDocs = [];
      for (const file of attachments) {
        const uploadResult = await uploadEncryptedFile(file.uri, file.name, file.mimeType);
        attachment_urls.push(uploadResult.url);
        uploadedDocs.push({
          name: file.name,
          url: uploadResult.url,
        });
      }

      const visitPayload = {
        doctor_name: doctorName,
        visit_date: visitDate,
        reason,
        notes,
        circle_id: circleId,
      };

      let savedVisitId = editingVisitId;
      if (editingVisitId) {
        const existingVisit = visits.find(v => v.id === editingVisitId);
        if (existingVisit && existingVisit.attachment_urls) {
          visitPayload.attachment_urls = [...existingVisit.attachment_urls, ...attachment_urls];
        } else {
          visitPayload.attachment_urls = attachment_urls;
        }
        await updateDoctorVisit(editingVisitId, visitPayload);
      } else {
        visitPayload.attachment_urls = attachment_urls;
        const newVisit = await addDoctorVisit(visitPayload);
        if (newVisit && newVisit.data && newVisit.data.id) {
          savedVisitId = newVisit.data.id;
        }
      }

      // Register new attachments in Document Hub under 'Reports' category
      for (const doc of uploadedDocs) {
        try {
          await addDocumentMetadata({
            circle_id: circleId,
            uploaded_by: user?.id,
            title: doc.name || 'Doctor Visit Attachment',
            category: 'Reports',
            file_url: doc.url,
            visit_id: savedVisitId || null,
          });
        } catch (docErr) {
          console.warn('Failed to add document metadata:', docErr);
        }
      }

      setModalVisible(false);
      resetForm();
      fetchVisits();
    } catch (error) {
       console.error('Failed to save visit', error);
       Alert.alert('Error', 'Failed to save visit');
       setLoading(false);
    }
  };

  const handleDeleteVisit = (visitId) => {
    Alert.alert(
      'Delete Visit',
      'Are you sure you want to delete this doctor visit record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDoctorVisit(visitId);
              fetchVisits();
            } catch (error) {
              console.error('Failed to delete visit', error);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setDoctorName('');
    setVisitDate('');
    setReason('');
    setNotes('');
    setAttachments([]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // fallback
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderAttachment = (url, index) => (
    <TouchableOpacity
      key={index}
      style={styles.attachmentChip}
      onPress={() => navigation.navigate('AttachmentViewer', { url })}
    >
      <Text style={styles.attachmentText}>Attachment {index + 1}</Text>
    </TouchableOpacity>
  );

  const renderVisitCard = ({ item }) => (
    <View style={styles.timelineItem}>
      {/* Timeline line and dot */}
      <View style={styles.timelineGraphic}>
        <View style={styles.timelineDot} />
        <View style={styles.timelineLine} />
      </View>

      {/* Card Content */}
      <TouchableOpacity 
        style={styles.card}
        onLongPress={() => handleDeleteVisit(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.doctorName}>{item.doctor_name}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={{minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginRight: 4}}>
              <Ionicons name="pencil" size={20} color={PRIMARY_BLUE} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteVisit(item.id)} style={{minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center'}}>
              <Ionicons name="trash-outline" size={20} color="#E53935" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.visitDate}>{formatDate(item.visit_date)}</Text>

        {!!item.reason && (
          <Text style={styles.reasonText}>Reason: {item.reason}</Text>
        )}
        
        {!!item.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {item.attachment_urls && item.attachment_urls.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {item.attachment_urls.map((url, i) => renderAttachment(url, i))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={PRIMARY_BLUE} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Doctor Visits</Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity
            style={styles.summaryBtn}
            onPress={handleGenerateSummary}
          >
            <Text style={styles.summaryBtnText}>✨ AI Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addIconBtn}
            onPress={openAddModal}
          >
            <Text style={styles.addIconText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderVisitCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No visit logs found.</Text>
          }
        />
      )}

      {/* Add Visit Log Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={[styles.modalContainer, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 20) : 0 }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Visit Log</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Doctor Name"
              value={doctorName}
              onChangeText={setDoctorName}
            />
            <TextInput
              style={styles.input}
              placeholder="Visit Date (YYYY-MM-DD)"
              value={visitDate}
              onChangeText={setVisitDate}
            />
            <TextInput
              style={styles.input}
              placeholder="Reason for Visit"
              value={reason}
              onChangeText={setReason}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Clinic Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.attachBtn}
              onPress={handleAttach}
            >
              <Text style={styles.attachBtnText}>[Attach Documents] ({attachments.length} selected)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSaveVisit}
            >
              <Text style={styles.submitBtnText}>Save Visit</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* AI Summary Modal */}
      <Modal
        visible={summaryModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSummaryModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 20) : 0 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>✨ Doctor Visit Briefing</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSummaryModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={{flex: 1, padding: 20}}>
            {generatingSummary ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={PRIMARY_BLUE} />
                <Text style={{marginTop: 10, color: '#64748B'}}>Analyzing 30-day telemetry...</Text>
              </View>
            ) : (
              <FlatList 
                data={[{key: '1'}]}
                renderItem={() => <Text style={{fontSize: 16, lineHeight: 24, color: '#334155'}}>{aiSummary}</Text>}
              />
            )}
          </View>
        </View>
      </Modal>

      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: THEME.colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitle: {
    ...THEME.typography.header,
    fontSize: 22,
    color: THEME.colors.textHeader,
  },
  backBtn: {
    minHeight: TOUCH_TARGET_SIZE,
    minWidth: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  addIconBtn: {
    minHeight: TOUCH_TARGET_SIZE,
    minWidth: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  addIconText: {
    fontSize: 28,
    color: PRIMARY_BLUE,
    fontWeight: '400',
  },
  summaryBtn: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBtnText: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyText: {
    ...THEME.typography.body,
    textAlign: 'center',
    color: THEME.colors.textMuted,
    marginTop: 40,
  },
  // Timeline Styles
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineGraphic: {
    width: 30,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: PRIMARY_BLUE,
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: THEME.colors.border,
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  doctorName: {
    ...THEME.typography.cardTitle,
    color: THEME.colors.textHeader,
    flex: 1,
  },
  visitDate: {
    ...THEME.typography.subtext,
    color: THEME.colors.textMuted,
    marginLeft: 8,
  },
  reasonText: {
    ...THEME.typography.body,
    color: THEME.colors.textBody,
    marginBottom: 8,
  },
  notesContainer: {
    backgroundColor: THEME.colors.canvas,
    padding: 14,
    borderRadius: THEME.borderRadius.input,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  notesText: {
    ...THEME.typography.body,
    color: THEME.colors.textBody,
    fontStyle: 'italic',
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attachmentChip: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    minHeight: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${THEME.colors.primary}30`,
  },
  attachmentText: {
    color: PRIMARY_BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.colors.cardBg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  modalTitle: {
    ...THEME.typography.header,
    fontSize: 20,
    color: THEME.colors.textHeader,
  },
  closeBtn: {
    minHeight: TOUCH_TARGET_SIZE,
    minWidth: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  closeBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  formContainer: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.input,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    minHeight: TOUCH_TARGET_SIZE,
    color: THEME.colors.textHeader,
    backgroundColor: THEME.colors.canvas,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  attachBtn: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: TOUCH_TARGET_SIZE,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  attachBtnText: {
    color: THEME.colors.textBody,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: THEME.borderRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET_SIZE,
    ...THEME.shadows.medium,
  },
  submitBtnText: {
    color: THEME.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DoctorVisitsScreen;
