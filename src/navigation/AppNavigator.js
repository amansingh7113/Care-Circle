import React, { useEffect } from 'react';
import { AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useStore } from '../store/useStore';
import CircleSelectionScreen from '../screens/CircleSelectionScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MedicineDashboardScreen from '../screens/MedicineDashboardScreen';
import CaregiverMedicinesScreen from '../screens/CaregiverMedicinesScreen';
import SleepTrackerService from '../components/SleepTrackerService';
import StepTrackerService from '../components/StepTrackerService';

import TaskBoardScreen from '../screens/TaskBoardScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DoctorVisitsScreen from '../screens/doctor/DoctorVisitsScreen';
import AttachmentViewerScreen from '../screens/doctor/AttachmentViewerScreen';
import ExpensesScreen from '../screens/expenses/ExpensesScreen';
import DocumentsScreen from '../screens/documents/DocumentsScreen';
import PatientDashboardScreen from '../screens/medicines/PatientDashboardScreen';
import BloodPressureHistoryScreen from '../screens/home/BloodPressureHistoryScreen';
import SleepDetailsScreen from '../screens/home/SleepDetailsScreen';
import EditProfileScreen from '../screens/settings/EditProfileScreen';
import ManageCircleScreen from '../screens/settings/ManageCircleScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import StepHistoryScreen from '../screens/home/StepHistoryScreen';
import ExportReportScreen from '../screens/settings/ExportReportScreen';
import PremiumUpgradeScreen from '../screens/settings/PremiumUpgradeScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const user = useStore(state => state.user);
  const _hasHydrated = useStore(state => state._hasHydrated);
  const currentCircle = useStore(state => state.currentCircle);
  const subscribeToCircle = useStore(state => state.subscribeToCircle);
  const unsubscribeFromCircle = useStore(state => state.unsubscribeFromCircle);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        unsubscribeFromCircle();
      } else if (nextAppState === 'active') {
        if (currentCircle?.id) {
          subscribeToCircle(currentCircle.id);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentCircle?.id, subscribeToCircle, unsubscribeFromCircle]);

  if (!_hasHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <>
      <SleepTrackerService />
      <StepTrackerService />
      <Stack.Navigator
        initialRouteName="CircleSelection"
        screenOptions={{
          headerShown: false,
        }}
      >
      <Stack.Screen name="CircleSelection" component={CircleSelectionScreen} />
      
      {user?.role === 'Patient' ? (
        <>
          <Stack.Screen name="Dashboard" component={PatientDashboardScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ExportReport" component={ExportReportScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="MedicineTracker" component={MedicineDashboardScreen} />
          <Stack.Screen name="MedicineAnalytics" component={CaregiverMedicinesScreen} />

          <Stack.Screen name="TaskBoard" component={TaskBoardScreen} />
          <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="PremiumUpgrade" component={PremiumUpgradeScreen} />
          <Stack.Screen name="ExportReport" component={ExportReportScreen} />
          <Stack.Screen name="Documents" component={DocumentsScreen} />
          <Stack.Screen name="DoctorVisits" component={DoctorVisitsScreen} />
          <Stack.Screen name="AttachmentViewer" component={AttachmentViewerScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
          <Stack.Screen name="BloodPressureHistory" component={BloodPressureHistoryScreen} />
          <Stack.Screen name="SleepDetails" component={SleepDetailsScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ManageCircle" component={ManageCircleScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
          <Stack.Screen name="StepHistory" component={StepHistoryScreen} />
        </>
      )}
    </Stack.Navigator>
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default AppNavigator;
