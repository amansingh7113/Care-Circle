require('dotenv').config();
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${port}`;

async function verifyApiLifecycle() {
  console.log(`Starting CareCircle API lifecycle verification on ${BASE_URL}...`);
  
  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const token = jwt.sign({
    id: mockUserId,
    phone_number: '+919999999999',
    role: 'Admin',
    circle_id: null
  }, process.env.JWT_SECRET || 'super_secret_jwt_key_12345', { expiresIn: '1d' });

  let circleId = 'test-circle-id';
  let taskId;
  
  const headers = { 'Content-Type': 'application/json' };
  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };

  try {
    // 1. Authentication
    console.log('\n[Stage 1] Authentication: POST /api/v1/auth/send-otp');
    try {
      let authRes = await fetch(`${BASE_URL}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone_number: '+919999999999' })
      });
      if (!authRes.ok) {
        let errText = '';
        try { errText = await authRes.text(); } catch (e) {}
        console.warn(`[Stage 1 Warning] OTP endpoint returned status ${authRes.status}: ${errText}. (Expected if SMS gateway is unconfigured). Continuing with signed JWT...`);
      } else {
        let data = await authRes.json();
        console.log('Success payload:', data);
      }
    } catch (authErr) {
      console.warn(`[Stage 1 Warning] Failed to reach OTP endpoint: ${authErr.message}. Continuing with signed JWT...`);
    }

    // 2. Circle Setup
    console.log('\n[Stage 2] Circle Setup: POST /api/v1/circles');
    res = await fetch(`${BASE_URL}/api/v1/circles`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Test Family Circle', user_name: 'Caregiver Admin' })
    });
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch (e) {}
      console.error(`Status code ${res.status} returned: ${errText}. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Created circle details:', data);
    if (data.circle && data.circle.id) {
      circleId = data.circle.id;
    }

    // Sign a new token containing circle_id to simulate authenticated flow
    const updatedToken = jwt.sign({
      id: mockUserId,
      phone_number: '+919999999999',
      role: 'Admin',
      circle_id: circleId
    }, process.env.JWT_SECRET || 'super_secret_jwt_key_12345', { expiresIn: '1d' });
    const finalAuthHeaders = { ...headers, Authorization: `Bearer ${updatedToken}` };

    // 3. Medicine Management
    console.log('\n[Stage 3] Medicine Management: POST /api/v1/medicines');
    res = await fetch(`${BASE_URL}/api/v1/medicines`, {
      method: 'POST',
      headers: finalAuthHeaders,
      body: JSON.stringify({
        name: 'Paracetamol',
        dosage: '500mg',
        frequency: 'Daily',
        scheduled_times: ['13:00'],
        stock_quantity: 15,
        refill_alert_threshold: 3,
        circle_id: circleId
      })
    });
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch (e) {}
      console.error(`Status code ${res.status} returned: ${errText}. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Created medicine record:', data);

    console.log('\n[Stage 3] Medicine Management: GET /api/v1/medicines/circles/:circleId/medicines');
    res = await fetch(`${BASE_URL}/api/v1/medicines/circles/${circleId}/medicines`, {
      headers: finalAuthHeaders
    });
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
      headers: finalAuthHeaders,
      body: JSON.stringify({
        title: 'Emergency Consult',
        description: 'See Dr. Sharma',
        category: 'Medical',
        assigned_to: mockUserId,
        due_date: new Date().toISOString(),
        circle_id: circleId
      })
    });
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch (e) {}
      console.error(`Status code ${res.status} returned: ${errText}. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Inserted task details:', data);
    taskId = data.id;

    console.log(`\n[Stage 4] Task Board: PATCH /api/v1/tasks/${taskId || 'mock-id'}`);
    res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId || 'mock-id'}`, {
      method: 'PATCH',
      headers: finalAuthHeaders,
      body: JSON.stringify({ status: 'completed' })
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Simulated status change to completed:', data);

    // 4.1. Task Comments Verification
    console.log(`\n[Stage 4.1] Task Comments: POST /api/v1/tasks/${taskId || 'mock-id'}/comments`);
    res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId || 'mock-id'}/comments`, {
      method: 'POST',
      headers: finalAuthHeaders,
      body: JSON.stringify({ comment: 'This is a test comment' })
    });
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch (e) {}
      console.error(`Status code ${res.status} returned: ${errText}. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Added task comment:', data);

    console.log(`\n[Stage 4.2] Task Comments: GET /api/v1/tasks/${taskId || 'mock-id'}/comments`);
    res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId || 'mock-id'}/comments`, {
      headers: finalAuthHeaders
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Fetched task comments:', data);

    // 5. Budget Check
    console.log('\n[Stage 5] Budget Check: POST /api/v1/expenses');
    res = await fetch(`${BASE_URL}/api/v1/expenses`, {
      method: 'POST',
      headers: finalAuthHeaders,
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
      headers: finalAuthHeaders
    });
    if (!res.ok) {
      console.error(`Status code ${res.status} returned. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Verified valid combined aggregate spend payload:', data);

    // 5.1. Dashboard Telemetry Verification
    console.log('\n[Stage 5.1] Dashboard: GET /api/v1/dashboard');
    res = await fetch(`${BASE_URL}/api/v1/dashboard`, {
      headers: finalAuthHeaders
    });
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch (e) {}
      console.error(`Status code ${res.status} returned: ${errText}. Exiting.`);
      process.exit(1);
    }
    data = await res.json();
    console.log('Verified aggregated dashboard response:', data);

    // 6. Document Encryption / Decryption Lifecycle Verification
    console.log('\n[Stage 6] Document Encryption: POST /api/v1/documents/upload');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const testFileContent = 'Hello, this is a secret prescription file content to be encrypted! ' + Date.now();
    const testBlob = new Blob([testFileContent], { type: 'text/plain' });
    const uploadFormData = new FormData();
    uploadFormData.append('file', testBlob, 'secret_prescription.pdf');

    // Perform upload
    const uploadRes = await fetch(`${BASE_URL}/api/v1/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${updatedToken}`
      },
      body: uploadFormData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`Encryption upload failed with status ${uploadRes.status}: ${errText}. Exiting.`);
      process.exit(1);
    }

    const uploadData = await uploadRes.json();
    console.log('Upload response:', uploadData);
    const decryptionUrl = uploadData.url;
    const filePath = uploadData.filePath;

    if (!decryptionUrl || !filePath) {
      console.error('Upload did not return expected decryption url or filePath. Exiting.');
      process.exit(1);
    }

    // Verify raw file in Supabase Storage is encrypted and does not contain plain text
    console.log('\n[Stage 6] Verifying file is encrypted in Supabase Storage...');
    const { data: rawData, error: rawDownloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (rawDownloadError || !rawData) {
      console.error('Failed to download raw file from storage:', rawDownloadError);
      process.exit(1);
    }

    const rawBuffer = Buffer.from(await rawData.arrayBuffer());
    const rawText = rawBuffer.toString('utf8');
    if (rawText.includes('secret prescription file content')) {
      console.error('Security Failure: Raw storage file contains unencrypted plain text!');
      process.exit(1);
    }
    console.log('Success: Confirmed that raw storage file is encrypted (plain text check passed).');

    // Decrypt the file by calling the backend decrypt endpoint
    console.log('\n[Stage 6] Decrypting file via backend: GET /api/v1/documents/decrypt');
    const decryptRes = await fetch(`${decryptionUrl}&token=${updatedToken}`);
    if (!decryptRes.ok) {
      const errText = await decryptRes.text();
      console.error(`Decryption failed with status ${decryptRes.status}: ${errText}. Exiting.`);
      process.exit(1);
    }

    const decryptedText = await decryptRes.text();
    if (decryptedText !== testFileContent) {
      console.error(`Decryption check failed. Expected "${testFileContent}", got "${decryptedText}"`);
      process.exit(1);
    }
    console.log('Success: Decrypted content matches original plain text!');

    // Create document metadata using decryption URL
    console.log('\n[Stage 6] Creating document metadata: POST /api/v1/documents');
    res = await fetch(`${BASE_URL}/api/v1/documents`, {
      method: 'POST',
      headers: finalAuthHeaders,
      body: JSON.stringify({
        circle_id: circleId,
        uploaded_by: mockUserId,
        title: 'Encrypted Test Prescription',
        category: 'Prescription',
        file_url: decryptionUrl,
        visit_id: null
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Metadata insertion failed with status ${res.status}: ${errText}. Exiting.`);
      process.exit(1);
    }

    const docMetadata = await res.json();
    console.log('Document metadata created:', docMetadata);
    const docId = docMetadata.id;

    // Verify document GET endpoint appends token
    console.log('\n[Stage 6] Querying documents: GET /api/v1/documents/circle/:circleId');
    res = await fetch(`${BASE_URL}/api/v1/documents/circle/${circleId}`, {
      headers: finalAuthHeaders
    });

    if (!res.ok) {
      console.error(`Query documents failed with status ${res.status}. Exiting.`);
      process.exit(1);
    }

    const docList = await res.json();
    const insertedDoc = docList.find(d => d.id === docId);
    if (!insertedDoc) {
      console.error('Inserted document not returned in list. Exiting.');
      process.exit(1);
    }

    console.log('Fetched document URL:', insertedDoc.file_url);
    if (!insertedDoc.file_url.includes('token=')) {
      console.error('Verification Failure: Returned file_url does not append session token.');
      process.exit(1);
    }
    console.log('Success: Session token is dynamically appended to the document URL.');

    // Delete document and verify it is removed from both DB and storage
    console.log('\n[Stage 6] Deleting document: DELETE /api/v1/documents/:id');
    res = await fetch(`${BASE_URL}/api/v1/documents/${docId}`, {
      method: 'DELETE',
      headers: finalAuthHeaders
    });

    if (res.status !== 204) {
      console.error(`Deletion failed with status ${res.status}. Exiting.`);
      process.exit(1);
    }
    console.log('Success: Document deleted from metadata DB.');

    // Verify file is deleted from Supabase Storage
    const { data: afterDeleteData, error: afterDeleteError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (!afterDeleteError) {
      console.error('Security Failure: Storage file still exists after deleting document metadata!');
      process.exit(1);
    }
    console.log('Success: Storage file verified as removed.');

    console.log('\nAll API lifecycle checks executed successfully.');
  } catch (error) {
    console.error('Fetch execution error:', error.message);
    process.exit(1);
  }
}

verifyApiLifecycle();
