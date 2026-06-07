import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../styles/theme';

const EmptyState = ({ iconName, titleText, subtitleText, actionText, onActionPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconBadge}>
        <Ionicons name={iconName} size={48} color={THEME.colors.primary} />
      </View>
      <Text style={styles.title}>{titleText}</Text>
      <Text style={styles.subtitle}>{subtitleText}</Text>
      {onActionPress && actionText && (
        <TouchableOpacity style={styles.button} onPress={onActionPress}>
          <Text style={styles.buttonText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: THEME.colors.canvas,
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${THEME.colors.primary}15`, // Light pastel primary background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...THEME.typography.header,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    ...THEME.typography.body,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: THEME.borderRadius.badge,
    ...THEME.shadows.soft,
  },
  buttonText: {
    color: THEME.colors.cardBg,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EmptyState;
