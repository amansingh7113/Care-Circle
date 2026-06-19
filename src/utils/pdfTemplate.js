export const generatePdfTemplate = ({ patientName, vitals, medicines, doctorVisits, generatedDate }) => {
  const getMedicinesHtml = () => {
    if (!medicines || medicines.length === 0) return '<p>No current medications.</p>';
    return `
      <table>
        <tr>
          <th>Name</th>
          <th>Dosage</th>
          <th>Status</th>
        </tr>
        ${medicines.map(m => `
          <tr>
            <td>${m.name || 'N/A'}</td>
            <td>${m.dosage || 'N/A'}</td>
            <td>${m.status || 'N/A'}</td>
          </tr>
        `).join('')}
      </table>
    `;
  };

  const getVitalsHtml = () => {
    if (!vitals || vitals.length === 0) return '<p>No recent vitals logged.</p>';
    return `
      <table>
        <tr>
          <th>Date</th>
          <th>Systolic</th>
          <th>Diastolic</th>
          <th>Heart Rate</th>
        </tr>
        ${vitals.slice(0, 10).map(v => `
          <tr>
            <td>${new Date(v.created_at || v.timestamp).toLocaleDateString()}</td>
            <td>${v.systolic || '-'}</td>
            <td>${v.diastolic || '-'}</td>
            <td>${v.heart_rate || '-'}</td>
          </tr>
        `).join('')}
      </table>
    `;
  };

  const getDoctorVisitsHtml = () => {
    if (!doctorVisits || doctorVisits.length === 0) return '<p>No recent doctor visits.</p>';
    return `
      <table>
        <tr>
          <th>Date</th>
          <th>Doctor</th>
          <th>Purpose</th>
          <th>Notes</th>
        </tr>
        ${doctorVisits.map(dv => `
          <tr>
            <td>${dv.visit_date ? new Date(dv.visit_date).toLocaleDateString() : 'N/A'}</td>
            <td>${dv.doctor_name || 'N/A'}</td>
            <td>${dv.purpose || 'N/A'}</td>
            <td>${dv.notes || '-'}</td>
          </tr>
        `).join('')}
      </table>
    `;
  };

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            padding: 20px;
            line-height: 1.6;
          }
          h1 {
            color: #1A73E8;
            border-bottom: 2px solid #1A73E8;
            padding-bottom: 10px;
            text-align: center;
          }
          h2 {
            color: #444;
            margin-top: 30px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          p {
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 14px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            color: #333;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #888;
          }
        </style>
      </head>
      <body>
        <h1>Medical Snapshot: ${patientName || 'CareCircle Patient'}</h1>
        <p><strong>Report Generated:</strong> ${generatedDate}</p>

        <h2>Current Medications (Last 30 Days)</h2>
        ${getMedicinesHtml()}

        <h2>Recent Vitals (Blood Pressure)</h2>
        ${getVitalsHtml()}

        <h2>Recent Doctor Visits</h2>
        ${getDoctorVisitsHtml()}

        <div class="footer">
          <p>This report was securely generated via CareCircle on ${generatedDate}.</p>
          <p>Please consult with a healthcare professional for medical advice.</p>
        </div>
      </body>
    </html>
  `;
};
