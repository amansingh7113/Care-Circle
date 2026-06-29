import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import { getDocuments, addDocumentMetadata, deleteDocument, uploadEncryptedFile } from '../../services/documentsApi';
import { getDoctorVisits } from '../../services/doctorVisitApi';
import { useStore } from '../../store/useStore';
import { THEME } from '../../styles/theme';
import { useFocusEffect } from '@react-navigation/native';
import { FileText, Trash2, Download, Tag, Sparkles, ArrowLeft } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const CATEGORIES = ['Prescription', 'Reports', 'Medicines', 'Bills'];

const DocumentsScreen = ({ navigation }) => {
  const [activeCategory, setActiveCategory] = useState('Prescription');
  const [documents, setDocuments] = useState([]);
  const [doctorVisits, setDoctorVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [selectedVisitId, setSelectedVisitId] = useState(null);

  const { user, currentCircle } = useStore();
  const circleId = currentCircle?.id || user?.circle_id;

  const fetchDocsAndVisits = async () => {
    if (!circleId) return;
    try {
      setIsLoading(true);
      const [docsData, visitsData] = await Promise.all([
        getDocuments(circleId),
        getDoctorVisits(circleId).catch(() => [])
      ]);
      setDocuments(docsData || []);
      setDoctorVisits(visitsData || []);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDocsAndVisits();
    }, [circleId])
  );

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      
      const file = result.assets[0];
      if (!file) return;

      let fileToUpload = file;
      if (file.mimeType && file.mimeType.startsWith('image/')) {
        const manipResult = await ImageManipulator.manipulateAsync(
          file.uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        fileToUpload = {
          ...file,
          uri: manipResult.uri,
          name: file.name.replace(/\.[^/.]+$/, ".jpg"),
          mimeType: 'image/jpeg'
        };
      }

      if (doctorVisits.length > 0) {
        setPendingFile(fileToUpload);
        setSelectedVisitId(null);
        setShowVisitModal(true);
      } else {
        await executeUpload(fileToUpload, null);
      }
    } catch (error) {
      console.error('File pick error:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const executeUpload = async (file, visitId) => {
    try {
      setIsUploading(true);
      setShowVisitModal(false);
      
      const uploadResult = await uploadEncryptedFile(file.uri, file.name, file.mimeType);

      await addDocumentMetadata({
        circle_id: circleId,
        uploaded_by: user.id,
        title: file.name,
        category: activeCategory,
        file_url: uploadResult.url,
        visit_id: visitId
      });

      Alert.alert('Success', 'Document uploaded successfully');
      setPendingFile(null);
      fetchDocsAndVisits();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument(docId);
            fetchDocsAndVisits();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete document');
          }
        }
      }
    ]);
  };

  const renderDocument = ({ item }) => (
    <View style={styles.docCard}>
      <View style={styles.docInfo}>
        <View style={styles.docIconContainer}>
          <FileText size={24} color={THEME.colors.primary} />
        </View>
        <View style={styles.docText}>
          <Text style={styles.docTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.docMeta}>
            Uploaded by {item.uploader?.name || 'Unknown'} • {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {item.doctor_visit && (
             <View style={styles.tagContainer}>
               <Tag size={12} color={THEME.colors.primary} style={{marginRight: 4}} />
               <Text style={styles.visitTag}>Visit: {item.doctor_visit.doctor_name}</Text>
             </View>
          )}
        </View>
      </View>
      <View style={styles.docActions}>
        {item.category === 'Prescription' && (
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AttachmentViewer', { url: item.file_url, isPrescription: true, autoOpenAI: true, documentId: item.id })}
          >
            <Sparkles size={20} color={THEME.colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => Linking.openURL(item.file_url)}
        >
          <Download size={20} color={THEME.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => handleDelete(item.id)}
        >
          <Trash2 size={20} color={THEME.colors.alert || '#E53935'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const filteredDocs = documents.filter(d => d.category === activeCategory);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BlurView intensity={90} tint="light" style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Hub</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <View style={styles.tabsContainer}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity 
            key={cat} 
            style={[styles.tab, activeCategory === cat && styles.activeTab]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.tabText, activeCategory === cat && styles.activeTabText]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          keyExtractor={item => item.id}
          renderItem={renderDocument}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No documents in {activeCategory}</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={handlePickFile}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator color={THEME.colors.white} />
        ) : (
          <Text style={styles.fabText}>+ Upload</Text>
        )}
      </TouchableOpacity>

      {/* Tag Doctor Visit Modal */}
      <Modal
        visible={showVisitModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVisitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tag Doctor Visit (Optional)</Text>
            <Text style={styles.modalSubTitle}>Link this document to a specific doctor visit.</Text>
            
            <ScrollView style={styles.visitList}>
              <TouchableOpacity 
                style={[styles.visitOption, selectedVisitId === null && styles.visitOptionSelected]}
                onPress={() => setSelectedVisitId(null)}
              >
                <Text style={[styles.visitOptionText, selectedVisitId === null && styles.visitOptionTextSelected]}>
                  No Visit / Skip
                </Text>
              </TouchableOpacity>
              
              {doctorVisits.map(visit => (
                <TouchableOpacity 
                  key={visit.id} 
                  style={[styles.visitOption, selectedVisitId === visit.id && styles.visitOptionSelected]}
                  onPress={() => setSelectedVisitId(visit.id)}
                >
                  <Text style={[styles.visitOptionText, selectedVisitId === visit.id && styles.visitOptionTextSelected]}>
                    Dr. {visit.doctor_name} ({new Date(visit.visit_date).toLocaleDateString()})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setShowVisitModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]} 
                onPress={() => executeUpload(pendingFile, selectedVisitId)}
              >
                <Text style={styles.saveButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.colors.canvas },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border
  },
  backBtn: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 24, color: THEME.colors.primary },
  headerTitle: { ...THEME.typography.header, fontSize: 22, color: THEME.colors.textHeader },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: THEME.colors.primary + '20',
  },
  tabText: {
    ...THEME.typography.label,
    color: THEME.colors.textMuted,
  },
  activeTabText: {
    color: THEME.colors.primary,
    fontWeight: 'bold',
  },
  listContent: { padding: 16, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { ...THEME.typography.body, color: THEME.colors.textMuted },
  docCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardBg,
    padding: 16,
    borderRadius: THEME.borderRadius.card,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...THEME.shadows.soft,
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  docInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  docIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  docText: { flex: 1 },
  docTitle: { ...THEME.typography.cardTitle, fontSize: 16, marginBottom: 4 },
  docMeta: { ...THEME.typography.label, fontSize: 12, color: THEME.colors.textMuted },
  tagContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: THEME.colors.primary + '10', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  visitTag: { fontSize: 11, color: THEME.colors.primary, fontWeight: '600' },
  docActions: { flexDirection: 'row', marginLeft: 12 },
  actionBtn: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    ...THEME.shadows.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabText: { color: THEME.colors.white, fontWeight: 'bold', fontSize: 16 },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    ...THEME.typography.header,
    fontSize: 18,
    marginBottom: 8,
  },
  modalSubTitle: {
    ...THEME.typography.body,
    color: THEME.colors.textMuted,
    marginBottom: 20,
  },
  visitList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  visitOption: {
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.button,
    marginBottom: 8,
  },
  visitOptionSelected: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  visitOptionText: {
    ...THEME.typography.body,
    color: THEME.colors.textBody,
  },
  visitOptionTextSelected: {
    color: THEME.colors.white,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: THEME.borderRadius.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: THEME.colors.canvas,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cancelButtonText: {
    color: THEME.colors.textBody,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
  },
  saveButtonText: {
    color: THEME.colors.white,
    fontWeight: '600',
  },
});

export default DocumentsScreen;
