import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/store/useStore';

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

    return () => {
      unsubHydrate?.();
      unsubFinishHydration?.();
    };
  }, []);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {userSession == null ? (
        <AuthNavigator />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}
