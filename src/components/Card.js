import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { THEME } from '../styles/theme';

const Card = ({ children, style, onPress, activeOpacity = 0.8, accessible, accessibilityLabel, accessibilityRole }) => {
  const containerStyles = [styles.card, style];

  if (onPress) {
    return (
      <TouchableOpacity
        style={[containerStyles, { minHeight: THEME.spacing.touchTarget }]}
        onPress={onPress}
        activeOpacity={activeOpacity}
        accessible={accessible}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole || 'button'}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyles}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: THEME.borderRadius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.medium,
  },
});

export default Card;
