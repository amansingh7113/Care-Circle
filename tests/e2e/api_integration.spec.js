const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const API_BASE_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = 'super_secret_jwt_key_12345';

// Generate static mock user ID
const mockUserId = crypto.randomUUID();

test.describe('Backend API Integration Tests', () => {
  let userToken;
  let circleId;
  let medicineId;
  let taskId;
  let vitalsId;

  test.beforeAll(async () => {
    // Generate initial valid JWT token for the mock user
    const initialPayload = {
      id: mockUserId,
      phone_number: '+919876543210',
      role: 'Caregiver',
      circle_id: null
    };
    userToken = jwt.sign(initialPayload, JWT_SECRET, { expiresIn: '7d' });
  });

  test('1. POST /circles - should create a new care circle and assign admin user', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/circles`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        name: 'API Integration Test Circle',
        user_name: 'Integration Admin'
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.message).toBe('Circle created successfully');
    expect(body.circle).toBeDefined();
    expect(body.circle.id).toBeDefined();
    expect(body.circle.name).toBe('API Integration Test Circle');

    circleId = body.circle.id;

    // Sign updated token with the new circleId
    const updatedPayload = {
      id: mockUserId,
      phone_number: '+919876543210',
      role: 'Admin',
      circle_id: circleId
    };
    userToken = jwt.sign(updatedPayload, JWT_SECRET, { expiresIn: '7d' });
  });

  test('2. GET /circles/:id - should fetch care circle details and members', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/circles/${circleId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.circle).toBeDefined();
    expect(body.circle.id).toBe(circleId);
    expect(body.members).toBeDefined();
    expect(body.members.length).toBeGreaterThan(0);
    expect(body.members[0].name).toBe('Integration Admin');
  });

  test('3. POST /circles/:id/invite - should generate join invite code', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/circles/${circleId}/invite`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { role: 'Caregiver' }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.message).toBe('Invite generated');
    expect(body.inviteCode).toBeDefined();
    expect(body.role).toBe('Caregiver');
  });

  test('4. POST /medicines - should add a new medicine to the circle', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/medicines`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        name: 'Integration Paracetamol',
        dosage: '500mg',
        frequency: 'Daily',
        scheduled_times: ['08:00', '20:00'],
        circle_id: circleId,
        stock_quantity: 20,
        refill_alert_threshold: 5
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Integration Paracetamol');
    expect(body.dosage).toBe('500mg');
    expect(body.circle_id).toBe(circleId);

    medicineId = body.id;
  });

  test('5. GET /medicines/circles/:circleId/medicines - should fetch active medicines', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/medicines/circles/${circleId}/medicines`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].name).toBe('Integration Paracetamol');
  });

  test('6. POST /medicines/:id/logs - should log a medicine dose as taken', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/medicines/${medicineId}/logs`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        status: 'taken',
        scheduled_time: '08:00'
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.medicine_id).toBe(medicineId);
    expect(body.circle_id).toBe(circleId);
    expect(body.status).toBe('taken');
  });

  test('7. GET /medicines/analytics/compliance - should fetch adherence analytics', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/medicines/analytics/compliance`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.adherence_rate_7d).toBeDefined();
    expect(body.adherence_rate_30d).toBeDefined();
    expect(body.total_taken).toBeGreaterThan(0);
    expect(body.status).toBeDefined();
  });

  test('8. POST /tasks - should create a new task in the circle', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/tasks`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        title: 'Integration Verification Task',
        description: 'Verifying task creation via Playwright API testing',
        category: 'Health',
        due_date: new Date(Date.now() + 86400000).toISOString(),
        circle_id: circleId
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Integration Verification Task');
    expect(body.circle_id).toBe(circleId);
    expect(body.status).toBe('pending');

    taskId = body.id;
  });

  test('9. POST /vitals - should log blood pressure vitals', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/vitals`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        circle_id: circleId,
        systolic: 120,
        diastolic: 80,
        pulse: 72
      }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.circle_id).toBe(circleId);
    expect(body.systolic).toBe(120);
    expect(body.diastolic).toBe(80);

    vitalsId = body.id;
  });

  test('10. GET /dashboard - should fetch centralized aggregated dashboard summary', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/dashboard?circle_id=${circleId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.medicines).toBeDefined();
    expect(body.data.tasks).toBeDefined();
    expect(body.data.vitals).toBeDefined();

    expect(body.data.medicines.some(m => m.id === medicineId)).toBe(true);
    expect(body.data.tasks.some(t => t.id === taskId)).toBe(true);
    expect(body.data.vitals.some(v => v.id === vitalsId)).toBe(true);
  });
});
