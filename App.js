import 'react-native-gesture-handler';
import './src/i18n';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/store/useStore';
import StepTrackerService from './src/components/StepTrackerService';
import SleepTrackerService from './src/components/SleepTrackerService';
import { navigationRef } from './src/services/navigationRef';
import * as Linking from 'expo-linking';
import NetworkListener from './src/components/NetworkListener';
import { registerForPushNotifications, setupNotificationListeners } from './src/services/pushNotifications';

export default function App() {
  const userSession = useStore((state) => state.userSession);
  const [hasHydrated, setHasHydrated] = useState(useStore.persist?.hasHydrated?.() ?? true);

  useEffect(() => {
    // Wait for Zustand to hydrate AsyncStorage data
    const unsubHydrate = useStore.persist?.onHydrate?.(() => setHasHydrated(false));
    const unsubFinishHydration = useStore.persist?.onFinishHydration?.(() => setHasHydrated(true));

    // Fallback if hydration already happened or isn't available
    if (!useStore.persist) {
      setHasHydrated(true);
    }

    // Push Notifications
    registerForPushNotifications();
    const cleanupNotifications = setupNotificationListeners(navigationRef);

    return () => {
      unsubHydrate?.();
      unsubFinishHydration?.();
      cleanupNotifications?.();
    };
  }, []);

  const linking = {
    prefixes: [Linking.createURL('/'), 'carecircle://'],
    config: {
      screens: {
        CircleSelection: 'join',
        Dashboard: 'dashboard',
        MedicineTracker: 'medicines',
      },
    },
  };

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <>
      <NetworkListener />
      <NavigationContainer ref={navigationRef} linking={linking}>
        {userSession == null ? (
          <AuthNavigator />
        ) : (
          <>
            <StepTrackerService />
            <SleepTrackerService />
            <AppNavigator />
          </>
        )}
      </NavigationContainer>
    </>
  );
}
