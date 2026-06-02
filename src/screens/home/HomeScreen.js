import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useStore from '../../store/useStore';

const HomeScreen = () => {
  const navigation = useNavigation();
  const user = useStore((state) => state.user) || { full_name: 'User' };
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    pendingMedicines: 0,
    activeTasks: 0,
    upcomingVisit: null,
    monthlySpend: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [medicinesRes, tasksRes, visitsRes, expensesRes] = await Promise.all([
          fetch('http://localhost:3000/api/v1/medicines').then(res => res.json()).catch(() => ({ data: [] })),
          fetch('http://localhost:3000/api/v1/tasks').then(res => res.json()).catch(() => ({ data: [] })),
          fetch('http://localhost:3000/api/v1/doctor-visits').then(res => res.json()).catch(() => ({ data: [] })),
          fetch('http://localhost:3000/api/v1/expenses/summary').then(res => res.json()).catch(() => ({ data: { total_spent: 0 } })),
        ]);

        const pendingMeds = (medicinesRes.data || []).filter(m => m.status === 'Pending').length;
        const activeTasksCount = (tasksRes.data || []).filter(t => t.status === 'Todo' || t.status === 'In Progress').length;
        
        const visits = visitsRes.data || [];
        const upcoming = visits.sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;

        const spent = expensesRes.data?.total_spent || 0;

        setMetrics({
          pendingMedicines: pendingMeds,
          activeTasks: activeTasksCount,
          upcomingVisit: upcoming,
          monthlySpend: spent,
        });
      } catch (error) {
        console.error('Error fetching dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });

    return unsubscribe;
  }, [navigation]);

  const DashboardCard = ({ title, value, subtitle, onPress, color }) => (
    <TouchableOpacity 
      style={[styles.card, { borderLeftColor: color }]} 
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
        {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {user.full_name}</Text>
          <Text style={styles.subGreeting}>Here is your care overview for today.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1A73E8" style={styles.loader} />
        ) : (
          <View style={styles.grid}>
            <DashboardCard 
              title="Medicines" 
              value={`${metrics.pendingMedicines} Pending`}
              color="#1A73E8"
              onPress={() => navigation.navigate('Medicines')}
            />
            <DashboardCard 
              title="Tasks" 
              value={`${metrics.activeTasks} Active`}
              color="#FFB300"
              onPress={() => navigation.navigate('Tasks')}
            />
            <DashboardCard 
              title="Doctor Visits" 
              value={metrics.upcomingVisit ? metrics.upcomingVisit.doctor_name : 'No upcoming'}
              subtitle={metrics.upcomingVisit ? new Date(metrics.upcomingVisit.date).toLocaleDateString() : ''}
              color="#43A047"
              onPress={() => navigation.navigate('DoctorVisits')}
            />
            <DashboardCard 
              title="Expenses" 
              value={`₹${metrics.monthlySpend}`}
              subtitle="This Month"
              color="#E53935"
              onPress={() => navigation.navigate('Expenses')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    marginTop: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subGreeting: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  loader: {
    marginTop: 40,
  },
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});

export default HomeScreen;
