import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { THEME } from '../styles/theme';

const SkeletonLoader = ({ style, count = 1, variant = 'card' }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const getVariantStyle = () => {
    switch (variant) {
      case 'circle':
        return { width: 48, height: 48, borderRadius: 24 };
      case 'text-line':
        return { width: '80%', height: 14, borderRadius: 7 };
      case 'text-short':
        return { width: '50%', height: 14, borderRadius: 7 };
      case 'list-item':
        return { width: '100%', height: 72, borderRadius: THEME.borderRadius.card };
      case 'card':
      default:
        return { width: '100%', height: 90, borderRadius: THEME.borderRadius.card };
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeleton,
            getVariantStyle(),
            { opacity },
            i > 0 && { marginTop: 12 },
            style,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  skeleton: {
    backgroundColor: THEME.colors.border,
  },
});

export default SkeletonLoader;
