export const THEME = {
  colors: {
    canvas: '#F8FAFC',       // Soft off-white background
    cardBg: '#FFFFFF',       // White for clean card depth
    primary: '#0D9488',      // Empathetic Teal/Sage accent
    secondary: '#6366F1',    // Indigo for Care Circle community
    alert: '#EF4444',        // Soft Coral Red for missed/critical states
    success: '#22C55E',      // Muted Emerald for completed logs
    textHeader: '#1E293B',   // Deep Navy for headers
    textBody: '#334155',     // Slate for scannable card text
    textMuted: '#64748B',    // Soft grey for secondary labels/times
    border: '#E2E8F0'        // Light subtle boundary border
  },
  typography: {
    header: { fontSize: 28, fontWeight: '700', color: '#1E293B' },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
    body: { fontSize: 14, fontWeight: '400', color: '#334155' },
    muted: { fontSize: 12, fontWeight: '400', color: '#64748B' }
  },
  shadows: {
    soft: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3
    }
  },
  borderRadius: {
    card: 16,
    badge: 8
  }
};
