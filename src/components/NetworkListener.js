import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';
import { useStore } from '../store/useStore';
import { THEME } from '../styles/theme';

const NetworkListener = () => {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-50)).current;
  const flushPendingSync = useStore((state) => state.flushPendingSync);
  const pendingCount = useStore((state) => state.pendingSyncQueue?.length || 0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(offline);

      if (!offline && pendingCount > 0) {
        // Reconnected with pending mutations — flush
        flushPendingSync?.();
      }
    });

    return () => unsubscribe();
  }, [pendingCount]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -50,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <WifiOff size={16} color="#fff" />
      <Text style={styles.text}>No internet connection</Text>
      {pendingCount > 0 && (
        <Text style={styles.pendingText}>{pendingCount} pending</Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.colors.alert,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 9999,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
  pendingText: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
});

export default NetworkListener;
