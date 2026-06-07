import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const PulsingIcon = ({ children, style }) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleValue, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [scaleValue, opacityValue]);

  return (
    <Animated.View style={[style, { transform: [{ scale: scaleValue }], opacity: opacityValue }]}>
      {children}
    </Animated.View>
  );
};

export default PulsingIcon;
