const { test, expect } = require('@playwright/test');

test.describe('Settings and Management Screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('userToken', 'mock-jwt-token-for-e2e-testing');
      window.localStorage.setItem('care-circle-storage', JSON.stringify({
        state: {
          userSession: 'mock-jwt-token-for-e2e-testing',
          user: { role: 'Caregiver', userId: 'mock-id', name: 'Aman Singh', phone: '+919876543210', email: 'aman@carecircle.com', circle_id: 'mock-circle-id' },
          currentCircle: { id: 'mock-circle-id', name: 'Family Circle', is_premium: false }
        },
        version: 0
      }));
    });
  });

  test('should render main Settings screen and display premium upgrade banner', async ({ page }) => {
    await page.goto('http://localhost:8081/settings');
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('Upgrade to Premium')).toBeVisible();
    await expect(page.getByText('Preferences')).toBeVisible();
    await expect(page.getByText('Language')).toBeVisible();
    await expect(page.getByText('Log Out')).toBeVisible();
  });

  test('should render Premium Upgrade screen with Razorpay integration details', async ({ page }) => {
    await page.goto('http://localhost:8081/settings');
    await page.getByText('Upgrade to Premium').click();
    await expect(page.getByText('CareCircle Family Plan')).toBeVisible();
    await expect(page.getByText('Ad-Free Experience')).toBeVisible();
    await expect(page.getByText('Unlimited Caregivers')).toBeVisible();
    await expect(page.getByText('Upgrade Now - ₹149/mo')).toBeVisible();
  });

  test('should render Export Report screen and options', async ({ page }) => {
    await page.goto('http://localhost:8081/export-report');
    await expect(page.getByText('Export Report', { exact: true })).toBeVisible();
    await expect(page.getByText('Select Timeframe')).toBeVisible();
    await expect(page.getByText('Last 1 Month')).toBeVisible();
    await expect(page.getByText('Generate PDF Report')).toBeVisible();
  });

  test('should render Edit Profile screen with user details', async ({ page }) => {
    await page.goto('http://localhost:8081/edit-profile');
    await expect(page.getByText('Edit Profile', { exact: true })).toBeVisible();
    await expect(page.getByText('Full Name')).toBeVisible();
    await expect(page.getByText('Phone Number')).toBeVisible();
    await expect(page.getByText('Email Address')).toBeVisible();
  });

  test('should render Manage Circle screen with circle title', async ({ page }) => {
    await page.goto('http://localhost:8081/manage-circle');
    await expect(page.getByText('Manage Circle', { exact: true })).toBeVisible();
    await expect(page.getByText('Family Circle')).toBeVisible();
    await expect(page.getByText('Circle Members')).toBeVisible();
  });
});
