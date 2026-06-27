const { test, expect } = require('@playwright/test');

test.describe('Medicine Adherence Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Caregiver', userId: 'mock-id', name: 'Caregiver One', circle_id: 'mock-circle-id' },
          currentCircle: { id: 'mock-circle-id', name: 'Family Circle' },
          medicineAnalytics: {
            adherence_rate_7d: 95,
            adherence_rate_30d: 92,
            status: 'Excellent',
            total_taken: 28,
            total_missed: 1
          },
          analyticsLoading: false
        },
        version: 0
      }));
    });
  });

  test('should render Adherence Analytics screen and display statistics', async ({ page }) => {
    await page.goto('http://localhost:8081/medicine-analytics');
    
    // Verify main header
    await expect(page.getByText('ADHERENCE ANALYTICS')).toBeVisible();
    
    // Verify 7-day adherence statistics
    await expect(page.getByText('Adherence Rate (7 Days)')).toBeVisible();
    await expect(page.getByText('95%')).toBeVisible();
    await expect(page.getByText('Excellent')).toBeVisible();
    await expect(page.getByText('Taken Doses')).toBeVisible();
    
    // Verify 30-day trend
    await expect(page.getByText('30-Day Trend')).toBeVisible();
    await expect(page.getByText('92%')).toBeVisible();
  });
});
