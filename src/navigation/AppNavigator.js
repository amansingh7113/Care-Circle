import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CircleSelectionScreen from '../screens/CircleSelectionScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MedicineDashboardScreen from '../screens/MedicineDashboardScreen';
import AddMedicineScreen from '../screens/AddMedicineScreen';
import TaskBoardScreen from '../screens/TaskBoardScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="CircleSelection"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="CircleSelection" component={CircleSelectionScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="MedicineTracker" component={MedicineDashboardScreen} />
      <Stack.Screen name="AddMedicine" component={AddMedicineScreen} />
      <Stack.Screen name="TaskBoard" component={TaskBoardScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
