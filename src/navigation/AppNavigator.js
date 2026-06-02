import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useStore from '../store/useStore';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

import HomeScreen from '../screens/home/HomeScreen';

const PatientDashboardScreen = () => (
  <View style={styles.center}><Text>Patient Dashboard</Text></View>
);

const MedicinesScreen = () => (
  <View style={styles.center}><Text>Medicines</Text></View>
);

const TasksScreen = () => (
  <View style={styles.center}><Text>Tasks</Text></View>
);

const MoreScreen = () => (
  <View style={styles.center}><Text>More</Text></View>
);

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1A73E8',
        tabBarItemStyle: {
          minHeight: 48,
          minWidth: 48,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Medicines" component={MedicinesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
};

const PatientStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PatientDashboard" component={PatientDashboardScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const role = useStore((state) => state.role);

  return (
    <NavigationContainer>
      {role === 'Patient' ? <PatientStackNavigator /> : <MainTabNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
