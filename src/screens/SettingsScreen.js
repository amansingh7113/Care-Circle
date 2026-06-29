import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ScrollView, Share, ActivityIndicator } from 'react-native';
import { useStore } from '../store/useStore';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { THEME } from '../styles/theme';
import axios from 'axios';
import { API_BASE_URL } from '../services/apiConfig';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import AdBanner from '../components/AdBanner';

const SettingsScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  const clearSession = useStore(state => state.clearSession);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalType, setLegalType] = useState('');
  
  const [inviteCode, setInviteCode] = useState('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [inviteRole, setInviteRole] = useState('Caregiver');

  useEffect(() => {
    generateInviteCode(inviteRole);
  }, [inviteRole]);

  const generateInviteCode = async (role) => {
    setIsLoadingCode(true);
    try {
      const token = useStore.getState().userSession;
      const circleId = user?.circle_id || useStore.getState().currentCircle?.id;
      if (!circleId) throw new Error('No circle selected');
      
      const response = await axios.post(`${API_BASE_URL}/api/v1/circles/${circleId}/invite`, { role: role }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.inviteCode) {
        setInviteCode(response.data.inviteCode);
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
    
    setToastMessage(t('settings.codeCopied'));
    setTimeout(() => setToastMessage(''), 3000);
    
    try {
      await Share.share({
        message: `${t('settings.joinMyCircle')} ${inviteCode}`
      });
    } catch (error) {
      console.error('Share failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (clearSession) clearSession();
      Alert.alert(t('settings.loggedOutTitle'), t('settings.loggedOutBody'));
    } catch (error) {
      console.error(error);
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
        Alert.alert(t('settings.accountDeletedTitle'), t('settings.accountDeletedBody'));
        if (clearSession) clearSession();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      } else {
        throw new Error('Deletion failed');
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t('settings.error'), t('settings.deleteFailed'));
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
        <Text style={styles.header}>{t('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Premium Upgrade Banner */}
        {!currentCircle?.is_premium && (
          <TouchableOpacity 
            style={[styles.rowButton, { backgroundColor: THEME.colors.primary, borderColor: THEME.colors.primary, marginBottom: 24 }]} 
            onPress={() => navigation.navigate('PremiumUpgrade')}
          >
            <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="sparkles" size={22} color={THEME.colors.white} style={{ marginRight: 8 }} />
              <Text style={[styles.rowButtonText, { color: THEME.colors.white, fontSize: 16 }]}>Upgrade to Premium</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Language Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.preferences')}</Text>
          <View style={styles.languageRow}>
            <Text style={styles.languageLabel}>{t('settings.language')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langPills}>
              {[
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'हिन्दी' },
                { code: 'bn', label: 'বাংলা' },
                { code: 'ta', label: 'தமிழ்' },
                { code: 'te', label: 'తెలుగు' },
                { code: 'mr', label: 'मराठी' },
                { code: 'gu', label: 'ગુજરાતી' },
                { code: 'kn', label: 'ಕನ್ನಡ' }
              ].map(lang => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langPill, i18n.language === lang.code && styles.langPillActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    changeLanguage(lang.code);
                  }}
                >
                  <Text style={[styles.langPillText, i18n.language === lang.code && styles.langPillTextActive]}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Invite Member Component */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.invite')}</Text>
          <View style={styles.inviteCard}>
            <Text style={styles.inviteDescription}>
              {t('settings.inviteDesc')}
            </Text>
            
            <View style={styles.roleSelector}>
              {[
                { key: 'Caregiver', label: t('settings.roleCaregiver') },
                { key: 'Patient', label: t('settings.rolePatient') },
                { key: 'Viewer', label: t('settings.roleViewer') }
              ].map((roleObj) => (
                <TouchableOpacity 
                  key={roleObj.key}
                  style={[styles.rolePill, inviteRole === roleObj.key && styles.rolePillActive]}
                  onPress={() => setInviteRole(roleObj.key)}
                >
                  <Text style={[styles.rolePillText, inviteRole === roleObj.key && styles.rolePillTextActive]}>{roleObj.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.codeContainer}>
              {isLoadingCode ? (
                <ActivityIndicator color={THEME.colors.primary} />
              ) : (
                <Text style={styles.codeText}>{inviteCode || '---'}</Text>
              )}
            </View>
            
            <TouchableOpacity style={styles.shareButton} onPress={handleCopyShare} disabled={isLoadingCode}>
              <Ionicons name="share-social-outline" size={20} color={THEME.colors.cardBg} />
              <Text style={styles.shareButtonText}>{t('settings.copyShare')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
          <TouchableOpacity style={styles.rowButton} onPress={() => openLegal('privacy')}>
            <Text style={styles.rowButtonText}>{t('settings.privacy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowButton} onPress={() => openLegal('terms')}>
            <Text style={styles.rowButtonText}>{t('settings.terms')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={styles.rowButtonText}>{t('settings.editProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('ManageCircle')}>
            <Text style={styles.rowButtonText}>{t('settings.manageCircle')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowButton} onPress={() => navigation.navigate('ExportReport')}>
            <Text style={styles.rowButtonText}>{t('settings.exportReport')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rowButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>{t('settings.logout')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rowButton, styles.deleteButton]} onPress={() => setDeleteModalVisible(true)}>
            <Text style={styles.deleteButtonText}>{t('settings.deleteAccount')}</Text>
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
            <Text style={styles.modalTitle}>{t('settings.deleteModalTitle')}</Text>
            <Text style={styles.modalBody}>
              {t('settings.deleteModalBody')}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('settings.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteAccount}>
                <Text style={styles.confirmDeleteBtnText}>{t('settings.deletePermanently')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Legal Modal */}
      <Modal visible={legalModalVisible} animationType="slide">
        <View style={styles.legalModalContainer}>
          <Text style={styles.legalModalTitle}>{legalType === 'privacy' ? t('settings.privacy') : t('settings.terms')}</Text>
          <ScrollView style={styles.legalScrollView}>
            <Text style={styles.legalText}>
              {legalType === 'privacy' 
                ? 'We value your privacy. Your Care Circle data is securely stored and only accessible to your circle members...' 
                : 'By using CareCircle, you agree to these terms of service...'}
            </Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeLegalBtn} onPress={() => setLegalModalVisible(false)}>
            <Text style={styles.closeLegalBtnText}>{t('settings.close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.canvas, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 40 },
  header: { ...THEME.typography.header, color: THEME.colors.primary, marginBottom: 0, marginTop: 0 },
  backBtn: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -8 },
  section: { marginBottom: 32 },
  sectionTitle: { ...THEME.typography.cardTitle, marginBottom: 12 },
  rowButton: { backgroundColor: THEME.colors.cardBg, padding: 16, borderRadius: THEME.borderRadius.card, marginBottom: 8, ...THEME.shadows.soft, borderWidth: 1, borderColor: THEME.colors.border },
  rowButtonText: { ...THEME.typography.body, fontWeight: '600' },
  logoutButtonText: { ...THEME.typography.body, fontWeight: 'bold', color: THEME.colors.primary },
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
  roleSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: THEME.colors.canvas,
    borderRadius: THEME.borderRadius.badge,
    padding: 4
  },
  rolePill: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: THEME.borderRadius.badge,
  },
  rolePillActive: {
    backgroundColor: THEME.colors.primary,
  },
  rolePillText: {
    ...THEME.typography.label,
    color: THEME.colors.textMuted,
  },
  rolePillTextActive: {
    color: THEME.colors.cardBg,
    fontWeight: 'bold',
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
  cancelBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  cancelBtnText: { ...THEME.typography.body, fontWeight: '600' },
  confirmDeleteBtn: { backgroundColor: THEME.colors.alert, minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: THEME.borderRadius.badge },
  confirmDeleteBtnText: { color: THEME.colors.cardBg, fontWeight: 'bold' },

  legalModalContainer: { flex: 1, padding: 20, backgroundColor: THEME.colors.canvas, paddingTop: 60 },
  legalModalTitle: { ...THEME.typography.header, marginBottom: 20 },
  legalScrollView: { flex: 1, backgroundColor: THEME.colors.cardBg, padding: 16, borderRadius: THEME.borderRadius.card },
  legalText: { ...THEME.typography.body, lineHeight: 24 },
  closeLegalBtn: { backgroundColor: THEME.colors.primary, padding: 16, borderRadius: THEME.borderRadius.badge, alignItems: 'center', marginTop: 20 },
  closeLegalBtnText: { color: THEME.colors.cardBg, fontWeight: 'bold', fontSize: 16 }
});

export default SettingsScreen;
