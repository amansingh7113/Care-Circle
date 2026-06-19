const medicines = [
  {
    id: 'cab5e67e-15e0-4eb7-bd49-7eb859f6d4b4',
    circle_id: 'f795e0db-a0f2-4e2b-b732-353b2d288122',
    name: 'Aspirin',
    dosage: '50mg',
    instructions: '{"frequency":"Daily","scheduled_times":["06:15"],"days":[]}',
    created_at: '2026-06-17T19:46:04.076788+00:00',
    is_archived: false,
    stock_quantity: 30,
    refill_alert_threshold: 6
  }
];

const flattenedMedicines = [];
const todayStart = new Date();
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayName = daysOfWeek[todayStart.getDay()];
const logs = [];

medicines.forEach(med => {
  let instructions = {};
  try {
    let parsed = typeof med.instructions === 'string' ? JSON.parse(med.instructions) : med.instructions;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed); // Handle double stringification
    instructions = parsed || {};
  } catch(e) {
    console.log('error parsing', e);
  }
  
  const frequency = instructions.frequency || 'Daily';
  const scheduledTimes = instructions.scheduled_times || [];
  const days = instructions.days || [];

  if (frequency === 'Specific Days' && !days.includes(todayName)) {
    return;
  }
  
  if (scheduledTimes.length === 0 || frequency === 'As Needed') {
    const medLog = logs?.find(log => log.medicine_id === med.id);
    flattenedMedicines.push({
      ...med,
      scheduled_time: null,
      status: medLog ? medLog.status : 'pending',
      logged_by_name: null
    });
    return;
  }

  scheduledTimes.forEach(timeStr => {
    const medLog = logs?.find(log => log.medicine_id === med.id && (log.scheduled_time === timeStr || !log.scheduled_time));
    
    flattenedMedicines.push({
      ...med,
      slot_id: med.id + '-' + timeStr,
      scheduled_time: timeStr,
      status: medLog ? medLog.status : 'pending',
      logged_by_name: null
    });
  });
});

console.log(flattenedMedicines);
