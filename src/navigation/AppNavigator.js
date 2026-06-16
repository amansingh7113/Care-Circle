import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useStore } from '../store/useStore';
import CircleSelectionScreen from '../screens/CircleSelectionScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MedicineDashboardScreen from '../screens/MedicineDashboardScreen';
import CaregiverMedicinesScreen from '../screens/CaregiverMedicinesScreen';
import AddMedicineScreen from '../screens/AddMedicineScreen';
import TaskBoardScreen from '../screens/TaskBoardScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DoctorVisitsScreen from '../screens/doctor/DoctorVisitsScreen';
import ExpensesScreen from '../screens/expenses/ExpensesScreen';
import DocumentsScreen from '../screens/documents/DocumentsScreen';
import PatientDashboardScreen from '../screens/medicines/PatientDashboardScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const user = useStore(state => state.user);

  return (
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
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="MedicineTracker" component={MedicineDashboardScreen} />
          <Stack.Screen name="MedicineAnalytics" component={CaregiverMedicinesScreen} />
          <Stack.Screen name="AddMedicine" component={AddMedicineScreen} />
          <Stack.Screen name="TaskBoard" component={TaskBoardScreen} />
          <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Documents" component={DocumentsScreen} />
          <Stack.Screen name="DoctorVisits" component={DoctorVisitsScreen} />
          <Stack.Screen name="Expenses" component={ExpensesScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
