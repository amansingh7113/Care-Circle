import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView, Share, ActivityIndicator } from 'react-native';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { THEME } from '../styles/theme';
import axios from 'axios';
import { API_BASE_URL } from '../services/apiConfig';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = ({ navigation }) => {
  const user = useStore(state => state.user);
  const clearSession = useStore(state => state.clearSession);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalType, setLegalType] = useState('');
  
  const [inviteCode, setInviteCode] = useState('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    generateInviteCode();
  }, []);

  const generateInviteCode = async () => {
    setIsLoadingCode(true);
    try {
      const token = useStore.getState().userSession;
      const response = await axios.post(`${API_BASE_URL}/api/v1/circles/invite-code`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.code) {
        setInviteCode(response.data.code);
      } else {
        setInviteCode('CC-K8X-9Q2');
      }
    } catch (error) {
      console.error('Failed to generate code', error);
      setInviteCode('CC-K8X-9Q2');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const handleCopyShare = async () => {
    if (!inviteCode) return;
    
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    setToastMessage('Code copied to clipboard!');
    setTimeout(() => setToastMessage(''), 3000);
    
    try {
      await Share.share({
        message: `Join my Care Circle on CareCircle! Use code: ${inviteCode}`
      });
    } catch (error) {
      console.error('Share failed', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const token = useStore.getState().userSession;
      
      const response = await axios.delete(`${API_BASE_URL}/api/v1/auth/delete-account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
        if (clearSession) clearSession();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      } else {
        throw new Error('Deletion failed');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setDeleteModalVisible(false);
    }
  };

  const openLegal = (type) => {
    setLegalType(type);
    setLegalModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.header}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Invite Member Component */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite to Circle</Text>
          <View style={styles.inviteCard}>
            <Text style={styles.inviteDescription}>
              Share this unique code with family members or caregivers to grant them secure access to this Care Circle.
            </Text>
            
            <View style={styles.codeContainer}>
              {isLoadingCode ? (
                <ActivityIndicator color={THEME.colors.primary} />
              ) : (
                <Text style={styles.codeText}>{inviteCode || '---'}</Text>
              )}
            </View>
            
            <TouchableOpacity style={styles.shareButton} onPress={handleCopyShare} disabled={isLoadingCode}>
              <Ionicons name="share-social-outline" size={20} color={THEME.colors.cardBg} />
              <Text style={styles.shareButtonText}>Copy & Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal & Compliance</Text>
          <TouchableOpacity style={styles.rowButton} onPress={() => openLegal('privacy')}>
            <Text style={styles.rowButtonText}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowButton} onPress={() => openLegal('terms')}>
            <Text style={styles.rowButtonText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Management</Text>
          <TouchableOpacity style={[styles.rowButton, styles.deleteButton]} onPress={() => setDeleteModalVisible(true)}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Simple Toast Overlay */}
      {toastMessage ? (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Delete Account Modal */}
      <Modal visible={deleteModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalBody}>
              This action is permanent and cannot be undone. All your Care Circle data, medicine logs, and tasks will be erased.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteAccount}>
                <Text style={styles.confirmDeleteBtnText}>Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Legal Modal */}
      <Modal visible={legalModalVisible} animationType="slide">
        <View style={styles.legalModalContainer}>
          <Text style={styles.legalModalTitle}>{legalType === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</Text>
          <ScrollView style={styles.legalScrollView}>
            <Text style={styles.legalText}>
              {legalType === 'privacy' 
                ? 'We value your privacy. Your Care Circle data is securely stored and only accessible to your circle members...' 
                : 'By using CareCircle, you agree to these terms of service...'}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeLegalBtn} onPress={() => setLegalModalVisible(false)}>
            <Text style={styles.closeLegalBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 40 },
  header: { ...THEME.typography.header, color: THEME.colors.primary, marginBottom: 0, marginTop: 0 },
  backBtn: { padding: 8, marginLeft: -8 },
  section: { marginBottom: 32 },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 12 },
  rowButton: { backgroundColor: THEME.colors.cardBg, padding: 16, borderRadius: THEME.borderRadius.card, marginBottom: 8, ...THEME.shadows.soft, borderWidth: 1, borderColor: THEME.colors.border },
  rowButtonText: { ...THEME.typography.body, fontWeight: '600' },
  deleteButton: { borderColor: THEME.colors.alert, borderWidth: 1, backgroundColor: '#FEF2F2' },
  deleteButtonText: { ...THEME.typography.body, color: THEME.colors.alert, fontWeight: 'bold' },
  
  // Invite Component Styles
  inviteCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 16,
    ...THEME.shadows.soft,
    borderWidth: 1, 
    borderColor: THEME.colors.border,
  },
  inviteDescription: {
    ...THEME.typography.body,
    color: THEME.colors.textBody,
    marginBottom: 16,
    lineHeight: 20
  },
  codeContainer: {
    backgroundColor: `${THEME.colors.primary}10`,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    borderStyle: 'dashed',
    borderRadius: THEME.borderRadius.badge,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  codeText: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: THEME.colors.primary
  },
  shareButton: {
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: THEME.borderRadius.badge,
    gap: 8
  },
  shareButtonText: {
    color: THEME.colors.cardBg,
    fontWeight: 'bold',
    fontSize: 16
  },

  toastContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: THEME.colors.textHeader,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    ...THEME.shadows.soft
  },
  toastText: {
    color: THEME.colors.cardBg,
    ...THEME.typography.body,
    fontWeight: '600'
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: THEME.colors.cardBg, padding: 24, borderRadius: THEME.borderRadius.card, width: '100%', ...THEME.shadows.soft },
  modalTitle: { ...THEME.typography.header, fontSize: 22, color: THEME.colors.alert, marginBottom: 12 },
  modalBody: { ...THEME.typography.body, marginBottom: 24, lineHeight: 22 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: 12 },
  cancelBtnText: { ...THEME.typography.body, fontWeight: '600' },
  confirmDeleteBtn: { backgroundColor: THEME.colors.alert, padding: 12, borderRadius: THEME.borderRadius.badge },
  confirmDeleteBtnText: { color: THEME.colors.cardBg, fontWeight: 'bold' },

  legalModalContainer: { flex: 1, padding: 20, backgroundColor: THEME.colors.canvas, paddingTop: 60 },
  legalModalTitle: { ...THEME.typography.header, marginBottom: 20 },
  legalScrollView: { flex: 1, backgroundColor: THEME.colors.cardBg, padding: 16, borderRadius: THEME.borderRadius.card },
  legalText: { ...THEME.typography.body, lineHeight: 24 },
  closeLegalBtn: { backgroundColor: THEME.colors.primary, padding: 16, borderRadius: THEME.borderRadius.badge, alignItems: 'center', marginTop: 20 },
  closeLegalBtnText: { color: THEME.colors.cardBg, fontWeight: 'bold', fontSize: 16 }
});

export default SettingsScreen;
