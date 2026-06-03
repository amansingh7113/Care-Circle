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
  SafeAreaView
} from 'react-native';
import { getExpensesSummary, addExpense } from '../../services/expenseApi';

const ExpensesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_spent: 0, monthly_limit: 0, items: [] });
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Medical');

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

  const handleAddExpense = async () => {
    if (!amount) return;
    try {
      setLoading(true);
      await addExpense({ amount: Number(amount), category, description: 'Added via app' });
      setModalVisible(false);
      setAmount('');
      fetchExpensesSummary();
    } catch (error) {
      console.error('Failed to add expense', error);
      setLoading(false);
    }
  };

  const consumptionPercentage = summary.monthly_limit > 0 
    ? Math.min((summary.total_spent / summary.monthly_limit) * 100, 100) 
    : 0;

  const isOverBudget = summary.total_spent > summary.monthly_limit;
  const progressBarColor = isOverBudget ? '#D32F2F' : '#1A73E8';

  const renderItem = ({ item }) => (
    <View style={styles.transactionItem}>
      <View>
        <Text style={styles.transactionCategory}>{item.category}</Text>
        <Text style={styles.transactionDescription}>{item.description}</Text>
      </View>
      <Text style={styles.transactionAmount}>₹{item.amount}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#1A73E8" style={styles.loader} />
      ) : (
        <>
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

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
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
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]} 
                onPress={handleAddExpense}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFF',
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
