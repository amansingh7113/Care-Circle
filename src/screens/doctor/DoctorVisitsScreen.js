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
} from 'react-native';

const PRIMARY_BLUE = '#1A73E8';
const TOUCH_TARGET_SIZE = 48;

const DoctorVisitsScreen = () => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Form State
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      // Replace with your actual api client config if different
      const response = await fetch('http://10.218.115.31:5000/api/v1/doctor-visits');
      if (response.ok) {
        const data = await response.json();
        setVisits(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching doctor visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVisit = () => {
    // Basic validation could go here
    if (!doctorName || !visitDate) {
      Alert.alert('Error', 'Please provide at least a Doctor Name and Date');
      return;
    }
    
    // In a real implementation, POST to /api/v1/doctor-visits here
    const newVisit = {
      id: Math.random().toString(),
      doctor_name: doctorName,
      visit_date: visitDate,
      reason,
      notes,
      attachment_urls: [],
    };
    
    setVisits([newVisit, ...visits]);
    setModalVisible(false);
    resetForm();
  };

  const resetForm = () => {
    setDoctorName('');
    setVisitDate('');
    setReason('');
    setNotes('');
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
      onPress={() => console.log(`[OPEN ATTACHMENT VIEW FOR URL]: ${url}`)}
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.doctorName}>{item.doctor_name}</Text>
          <Text style={styles.visitDate}>{formatDate(item.visit_date)}</Text>
        </View>

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
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Doctor Visits</Text>
        <TouchableOpacity
          style={styles.addIconBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addIconText}>+</Text>
        </TouchableOpacity>
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
        <SafeAreaView style={styles.modalContainer}>
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
              onPress={() => console.log('Attach Documents pressed')}
            >
              <Text style={styles.attachBtnText}>[Attach Documents]</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddVisit}
            >
              <Text style={styles.submitBtnText}>Save Visit</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  addIconBtn: {
    minHeight: TOUCH_TARGET_SIZE,
    minWidth: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  addIconText: {
    fontSize: 28,
    color: PRIMARY_BLUE,
    fontWeight: '400',
  },
  listContent: {
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
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
    backgroundColor: '#CBD5E1',
    marginTop: 4,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  visitDate: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 8,
  },
  reasonText: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
  },
  notesContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
  },
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attachmentChip: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    minHeight: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
  },
  attachmentText: {
    color: PRIMARY_BLUE,
    fontSize: 12,
    fontWeight: '500',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    minHeight: TOUCH_TARGET_SIZE,
    minWidth: TOUCH_TARGET_SIZE,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  closeBtnText: {
    color: '#64748B',
    fontSize: 16,
  },
  formContainer: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    minHeight: TOUCH_TARGET_SIZE,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  attachBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: TOUCH_TARGET_SIZE,
  },
  attachBtnText: {
    color: '#475569',
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET_SIZE,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DoctorVisitsScreen;
