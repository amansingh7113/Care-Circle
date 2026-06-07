import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const SkeletonLoader = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeleton, style, { opacity }]} />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    width: '100%',
    height: 90,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
});

export default SkeletonLoader;
