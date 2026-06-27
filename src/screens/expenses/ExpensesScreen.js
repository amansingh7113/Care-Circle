import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getExpensesSummary, addExpense, deleteExpense, updateExpense, updateBudget } from '../../services/expenseApi';
import { useStore } from '../../store/useStore';
import { Ionicons } from '@expo/vector-icons';
import AdBanner from '../../components/AdBanner';

const ExpensesScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_spent: 0, monthly_limit: 0, items: [] });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Medical');
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const { currentCircle, user } = useStore();
  const circleId = currentCircle?.id || user?.circle_id;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchExpensesSummary();
  }, []);

  const fetchExpensesSummary = async () => {
    try {
      setLoading(true);
      const data = await getExpensesSummary();
      setSummary({ ...data, items: data.expenses || [] });
    } catch (error) {
      console.error('Failed to fetch expenses summary', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingExpenseId(null);
    setAmount('');
    setDescription('');
    setCategory('Medical');
    setModalVisible(true);
  };

  const openEditModal = (expense) => {
    setEditingExpenseId(expense.id);
    setAmount(expense.amount.toString());
    setDescription(expense.description || '');
    setCategory(expense.category || 'Medical');
    setModalVisible(true);
  };

  const handleSaveExpense = async () => {
    if (!amount || !description) return;
    try {
      setLoading(true);
      const payload = { amount: Number(amount), category, description, circle_id: circleId };
      if (editingExpenseId) {
        await updateExpense(editingExpenseId, payload);
      } else {
        await addExpense(payload);
      }
      setModalVisible(false);
      setAmount('');
      setDescription('');
      fetchExpensesSummary();
    } catch (error) {
      console.error('Failed to save expense', error);
      setLoading(false);
    }
  };

  const handleDeleteExpense = (expenseId) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteExpense(expenseId);
              fetchExpensesSummary();
            } catch (error) {
              console.error('Failed to delete expense', error);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const openBudgetModal = () => {
    setNewBudgetAmount(summary.monthly_limit?.toString() || '');
    setBudgetModalVisible(true);
  };

  const handleSaveBudget = async () => {
    if (!newBudgetAmount) return;
    try {
      setLoading(true);
      await updateBudget(Number(newBudgetAmount));
      setBudgetModalVisible(false);
      fetchExpensesSummary();
    } catch (error) {
      console.error('Failed to update budget', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to update budget');
    }
  };

  const consumptionPercentage = summary.monthly_limit > 0 
    ? Math.min((summary.total_spent / summary.monthly_limit) * 100, 100) 
    : 0;

  const isOverBudget = summary.total_spent > summary.monthly_limit;
  const progressBarColor = isOverBudget ? '#D32F2F' : '#1A73E8';

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.transactionItem}
      onLongPress={() => handleDeleteExpense(item.id)}
      activeOpacity={0.8}
    >
      <View style={{flex: 1}}>
        <Text style={styles.transactionCategory}>{item.category}</Text>
        <Text style={styles.transactionDescription}>{item.description}</Text>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={[styles.transactionAmount, {marginRight: 12}]}>₹{item.amount}</Text>
        <TouchableOpacity onPress={() => openEditModal(item)} style={{minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginRight: 4}}>
          <Ionicons name="pencil" size={18} color="#1A73E8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteExpense(item.id)} style={{minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center'}}>
          <Ionicons name="trash-outline" size={18} color="#D32F2F" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#1A73E8" style={styles.loader} />
      ) : (
        <>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#1A73E8" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Expenses</Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={openBudgetModal} style={styles.editBudgetBtn}>
                <Text style={styles.editBudgetBtnText}>Edit Budget</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addIconBtn} onPress={openAddModal}>
                <Text style={styles.addIconText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Spent: ₹{summary.total_spent} / ₹{summary.monthly_limit}
            </Text>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${consumptionPercentage}%`, backgroundColor: progressBarColor }
                ]} 
              />
            </View>
          </View>

          <FlatList
            data={summary.items}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
          />
        </>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={styles.input}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.categoryPickerContainer}>
              {['Medical', 'Pharmacy', 'Caregiver', 'Other'].map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.categoryOption, category === cat && styles.categoryOptionSelected]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryOptionText, category === cat && styles.categoryOptionTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveExpense}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Budget Modal */}
      <Modal
        visible={budgetModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Monthly Budget</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter monthly limit (e.g. 5000)"
              keyboardType="numeric"
              value={newBudgetAmount}
              onChangeText={setNewBudgetAmount}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setBudgetModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveBudget}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
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
  backBtn: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginRight: 8,
  },
  addIconBtn: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  addIconText: {
    fontSize: 28,
    color: '#1A73E8',
    fontWeight: '400',
  },
  editBudgetBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBudgetBtnText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  progressContainer: {
    padding: 20,
    backgroundColor: '#FFF',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  transactionItem: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  categoryPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 10,
  },
  categoryOption: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryOptionSelected: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#333',
  },
  categoryOptionTextSelected: {
    color: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1A73E8',
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});

export default ExpensesScreen;
