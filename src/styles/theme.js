export const THEME = {
  colors: {
    canvas: '#FAF6F0',       // Warm cream/off-white background
    cardBg: '#FFFFFF',       // Crisp white for cards
    deepNavy: '#0B1B3D',     // Deep midnight navy for dark themes
    primary: '#55A994',      // Calming medical sage green
    secondary: '#6366F1',    // Indigo (kept for variety if needed)
    alert: '#EF4444',        // Soft Coral Red
    success: '#34A853',      // Vibrant green for badges/success
    textHeader: '#0B1B3D',   // Deep Navy for headers
    textBody: '#334155',     // Slate for scannable card text
    textMuted: '#64748B',    // Soft grey
    border: '#E2E8F0',       // Light subtle boundary border
    white: '#FFFFFF',
    transparent: 'transparent'
  },
  gradients: {
    primary: ['#6366F1', '#55A994'],
  },
  typography: {
    header: { fontSize: 32, fontWeight: '900', color: '#0B1B3D', letterSpacing: -0.5 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#0B1B3D' },
    body: { fontSize: 14, fontWeight: '400', color: '#334155' },
    muted: { fontSize: 12, fontWeight: '400', color: '#64748B' },
    label: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  },
  shadows: {
    soft: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2
    }
  },
  borderRadius: {
    card: 16,
    badge: 8,
    pill: 24
  }
};
