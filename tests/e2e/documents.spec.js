const { test, expect } = require('@playwright/test');

test.describe('Document Hub Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Caregiver', userId: 'mock-id', name: 'Caregiver One', circle_id: 'mock-circle-id' },
          currentCircle: { id: 'mock-circle-id', name: 'Family Circle' }
        },
        version: 0
      }));
    });
  });

  test('should render Document Hub screen, display categories and empty state', async ({ page }) => {
    await page.goto('http://localhost:8081/documents');
    
    // Verify header and tabs
    await expect(page.getByText('Document Hub')).toBeVisible();
    await expect(page.getByText('Prescription', { exact: true })).toBeVisible();
    await expect(page.getByText('Reports', { exact: true })).toBeVisible();
    await expect(page.getByText('Medicines', { exact: true })).toBeVisible();
    await expect(page.getByText('Bills', { exact: true })).toBeVisible();
    
    // Verify upload button
    await expect(page.getByText('+ Upload')).toBeVisible();
    
    // Verify empty state for Prescription tab
    await expect(page.getByText('No documents in Prescription')).toBeVisible();
  });
});
