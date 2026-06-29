export const THEME = {
  colors: {
    canvas: '#F8F9FA',       // Light grey background, very sleek
    cardBg: '#FFFFFF',       // Crisp white for cards
    deepNavy: '#0F172A',     // Very dark slate for headers
    primary: '#1A73E8',      // Google Blue as per constraints
    secondary: '#059669',    // Emerald green for an elegant medical feel
    alert: '#E11D48',        // Soft elegant rose/coral
    danger: '#E11D48',       // Emergency danger rose
    success: '#10B981',      // Calmer Material Green for badges
    warning: '#F59E0B',      // Elegant Amber for warnings
    textHeader: '#0F172A',   // Deep slate for text
    textBody: '#475569',     // Slate for body
    textMuted: '#64748B',    // Slate 500 for WCAG AA compliant muted text
    border: '#E2E8F0',       // Clean, elegant border
    white: '#FFFFFF',
    transparent: 'transparent',
    // Soft elegant background tints for badges and cards
    primaryLight: '#E8F0FE',
    successLight: '#DCFCE7',
    alertLight: '#FFE4E6',
    warningLight: '#FEF3C7',
    infoLight: '#E0F2FE',
  },
  gradients: {
    primary: ['#1A73E8', '#3B82F6'],
    secondary: ['#059669', '#10B981'],
    alert: ['#E11D48', '#FB7185'],
    deep: ['#0F172A', '#1E293B']
  },
  typography: {
    header: { fontFamily: 'Inter_700Bold', fontSize: 30, fontWeight: '700', color: '#0F172A', letterSpacing: -0.5, lineHeight: 36 },
    cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3, lineHeight: 24 },
    body: { fontFamily: 'Inter_500Medium', fontSize: 15, fontWeight: '500', color: '#475569', lineHeight: 22 },
    muted: { fontFamily: 'Inter_500Medium', fontSize: 13, fontWeight: '500', color: '#64748B', lineHeight: 18 },
    subtext: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500', color: '#64748B', lineHeight: 16 },
    label: { fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 14 },
  },
  shadows: {
    soft: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2
    },
    medium: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4
    },
    heavy: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8
    }
  },
  borderRadius: {
    card: 20,
    badge: 8,
    pill: 24,
    button: 16
  },
  spacing: {
    touchTarget: 48 // Ensure 48dp minimum
  }
};
