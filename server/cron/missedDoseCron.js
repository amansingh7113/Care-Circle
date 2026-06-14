const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

let supabase;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  }
  return supabase;
}

// Helper function to check if a scheduled time has passed by a certain threshold (e.g., 1 hour)
function isDoseMissed(scheduledTimeStr) {
  const now = new Date();
  const [hours, minutes] = scheduledTimeStr.split(':').map(Number);
  
  const scheduledTime = new Date();
  scheduledTime.setHours(hours, minutes, 0, 0);

  // Add 1 hour grace period
  const gracePeriodEnd = new Date(scheduledTime.getTime() + 60 * 60 * 1000);
  
  return now > gracePeriodEnd;
}

async function checkMissedDoses() {
  console.log('[Cron] Checking for missed doses...', new Date().toISOString());
  
  try {
    // 1. Fetch all medicines
    const { data: medicines, error: medError } = await getSupabase()
      .from('medicines')
      .select('*');

    if (medError) throw medError;

    // 2. Fetch logs for the last 48 hours to be safe
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: logs, error: logsError } = await getSupabase()
      .from('medicine_dose_logs')
      .select('*')
      .gte('taken_at', twoDaysAgo.toISOString());

    if (logsError) throw logsError;

    const newLogsToInsert = [];
    const now = new Date();

    // 3. Evaluate each medicine
    for (const med of medicines) {
      if (!med.instructions) continue;
      
      let instructions;
      try {
        instructions = typeof med.instructions === 'string' ? JSON.parse(med.instructions) : med.instructions;
      } catch (e) {
        console.error(`[Cron] Error parsing instructions for medicine ${med.id}`, e);
        continue;
      }

      const scheduledTimes = instructions.scheduled_times || [];
      const medLogs = logs.filter(l => l.medicine_id === med.id);

      // Generate all expected dose times for Yesterday and Today
      const expectedDoseTimes = [];
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const frequency = instructions.frequency || 'Daily';
      const scheduledDays = instructions.days || [];

      const daysToCheck = [yesterday, today].filter(day => {
        if (frequency === 'Specific Days') {
          return scheduledDays.includes(daysOfWeek[day.getDay()]);
        }
        if (frequency === 'As Needed') {
          return false;
        }
        return true;
      });

      for (const day of daysToCheck) {
        for (const timeStr of scheduledTimes) {
          const [hours, minutes] = timeStr.split(':').map(Number);
          const doseTime = new Date(day);
          doseTime.setHours(hours, minutes, 0, 0);
          expectedDoseTimes.push({ timeStr, dateObj: doseTime });
        }
      }

      // Filter expected doses that have passed their grace period
      const passedDoses = expectedDoseTimes.filter(dose => {
        const gracePeriodEnd = new Date(dose.dateObj.getTime() + 60 * 60 * 1000);
        return now > gracePeriodEnd;
      });

      for (const dose of passedDoses) {
        // Find if any log exists for this specific day AND time slot
        const doseDayStart = new Date(dose.dateObj);
        doseDayStart.setHours(0, 0, 0, 0);
        const doseDayEnd = new Date(dose.dateObj);
        doseDayEnd.setHours(23, 59, 59, 999);

        const logExists = medLogs.some(l => {
          const logTime = new Date(l.taken_at);
          const isSameDay = logTime >= doseDayStart && logTime <= doseDayEnd;
          const isSameSlot = l.scheduled_time === dose.timeStr || !l.scheduled_time; // Fallback for legacy logs
          return isSameDay && isSameSlot;
        });

        if (!logExists) {
          newLogsToInsert.push({
            medicine_id: med.id,
            circle_id: med.circle_id,
            status: 'missed',
            taken_at: dose.dateObj.toISOString(),
            scheduled_time: dose.timeStr,
            logged_by: null // System generated
          });
          console.log(`[Cron] Flagging missed dose for Medicine: ${med.name} (Circle: ${med.circle_id}) at ${dose.timeStr} on ${dose.dateObj.toDateString()}`);
        }
      }
    }

    if (newLogsToInsert.length > 0) {
      const { error: insertError } = await getSupabase()
        .from('medicine_dose_logs')
        .insert(newLogsToInsert);
        
      if (insertError) throw insertError;
      console.log(`[Cron] Successfully inserted ${newLogsToInsert.length} missed dose logs.`);
    } else {
      console.log('[Cron] No new missed doses found.');
    }

  } catch (error) {
    console.error('[Cron] Error checking missed doses:', error);
  }
}

function startCron() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', checkMissedDoses);
  console.log('[Cron] Missed dose automation scheduled (hourly).');
  
  // Also run once immediately on startup for testing/syncing
  setTimeout(checkMissedDoses, 5000);
}

module.exports = { startCron, checkMissedDoses };
