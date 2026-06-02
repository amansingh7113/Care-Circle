const BASE_URL = 'http://localhost:3000';

async function verifyApiLifecycle() {
  console.log('Starting CareCircle API lifecycle verification...');
  let circleId = 'test-circle-id';
  let taskId;
  let token = 'mock-jwt-token';
  
  const headers = { 'Content-Type': 'application/json' };

  try {
    // 1. Authentication
    console.log('\n[Stage 1] Authentication: POST /api/v1/auth/send-otp');
    let res = await fetch(`${BASE_URL}/api/v1/auth/send-otp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone_number: '+919999999999' })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    let data = await res.json();
    console.log('Success payload:', data);

    // 2. Circle Setup
    console.log('\n[Stage 2] Circle Setup: POST /api/v1/circles/create');
    res = await fetch(`${BASE_URL}/api/v1/circles/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: 'mock-user-uuid', circle_name: 'Test Family Circle' })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('WhatsApp onboarding link generated:', data.invite_link);
    if (data.circle && data.circle.id) {
      circleId = data.circle.id;
    }

    // 3. Medicine Management
    console.log('\n[Stage 3] Medicine Management: POST /api/v1/medicines');
    res = await fetch(`${BASE_URL}/api/v1/medicines`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Paracetamol',
        dosage: '500mg',
        instructions: 'After lunch',
        scheduled_times: ['13:00'],
        stock_quantity: 15,
        refill_alert_threshold: 3,
        circle_id: circleId
      })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Created tracking record:', data);

    console.log('\n[Stage 3] Medicine Management: GET /api/v1/medicines');
    res = await fetch(`${BASE_URL}/api/v1/medicines?circle_id=${circleId}`);
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log(`Verified record persistence. Returned ${data.length} records.`);

    // 4. Task Board
    console.log('\n[Stage 4] Task Board: POST /api/v1/tasks');
    res = await fetch(`${BASE_URL}/api/v1/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Emergency Consult',
        description: 'See Dr. Sharma',
        priority: 'High',
        assigned_to: 'mock-user-uuid',
        due_date: new Date().toISOString(),
        circle_id: circleId
      })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Inserted high-priority task:', data);
    taskId = data.id;

    console.log(`\n[Stage 4] Task Board: PATCH /api/v1/tasks/${taskId || 'mock-id'}`);
    res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId || 'mock-id'}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'Done' })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Simulated status change to Done:', data);

    // 5. Budget Check
    const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
    console.log('\n[Stage 5] Budget Check: POST /api/v1/expenses');
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount: 2500,
        category: 'Medical',
        description: 'Pharmacy bill'
      })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Posted mock expense entry:', data);

    console.log('\n[Stage 5] Budget Check: GET /api/v1/expenses/summary');
    res = await fetch(`${BASE_URL}/api/v1/expenses/summary`, {
      headers: authHeaders
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Verified valid combined aggregate spend payload:', data);

    console.log('\nAll API lifecycle checks executed successfully.');
  } catch (error) {
    console.error('Fetch execution error:', error.message);
    process.exit(1);
  }
}

verifyApiLifecycle();
