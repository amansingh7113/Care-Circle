export const THEME = {
  colors: {
    canvas: '#F8F9FA',       // Light grey background, very sleek
    cardBg: '#FFFFFF',       // Crisp white for cards
    deepNavy: '#0F172A',     // Very dark slate for headers
    primary: '#1A73E8',      // Google Blue as per constraints
    secondary: '#00E676',    // Vibrant spring green for a pop of freshness
    alert: '#FF5252',        // Material Red accent
    success: '#00C853',      // Material Green for badges
    textHeader: '#0F172A',   // Deep slate for text
    textBody: '#475569',     // Slate for body
    textMuted: '#94A3B8',    // Lighter slate for muted text
    border: '#F1F5F9',       // Very subtle border
    white: '#FFFFFF',
    transparent: 'transparent'
  },
  gradients: {
    primary: ['#1A73E8', '#4285F4'],
    secondary: ['#00E676', '#1DE9B6'],
    alert: ['#FF5252', '#FF8A80'],
    deep: ['#0F172A', '#1E293B']
  },
  typography: {
    header: { fontSize: 32, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    body: { fontSize: 15, fontWeight: '500', color: '#475569' },
    muted: { fontSize: 13, fontWeight: '500', color: '#94A3B8' },
    label: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.0 },
  },
  shadows: {
    soft: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3
    },
    medium: {
      shadowColor: '#1A73E8',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6
    },
    heavy: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 10
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
