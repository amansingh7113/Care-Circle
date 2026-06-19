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

async function calculateStreaks() {
  console.log('[Cron] Calculating daily user streaks...', new Date().toISOString());
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: users, error: userErr } = await getSupabase()
      .from('users')
      .select('id, circle_id, current_streak, last_streak_date')
      .eq('role', 'Patient'); // Only gamify patients

    if (userErr || !users) throw userErr;

    for (const user of users) {
      if (user.last_streak_date === todayStr) continue; // Already calculated today

      // 1. Check Hydration
      const { data: hydration } = await getSupabase()
        .from('hydration_logs')
        .select('amount_ml')
        .eq('logged_by', user.id)
        .eq('date', todayStr);
      
      const hasHydration = hydration && hydration.reduce((s, l) => s + l.amount_ml, 0) > 0;

      // 2. Check Medicines (did they miss any today?)
      const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);
      
      const { data: missedMeds } = await getSupabase()
        .from('medicine_dose_logs')
        .select('id')
        .eq('circle_id', user.circle_id)
        .eq('status', 'missed')
        .gte('taken_at', startOfDay.toISOString())
        .lte('taken_at', endOfDay.toISOString());
      
      const noMissedMeds = !missedMeds || missedMeds.length === 0;

      let newStreak = user.current_streak || 0;
      if (hasHydration && noMissedMeds) {
        newStreak += 1;
      } else {
        newStreak = 0;
      }

      await getSupabase()
        .from('users')
        .update({ current_streak: newStreak, last_streak_date: todayStr })
        .eq('id', user.id);
    }
  } catch (err) {
    console.error('[Cron] Error calculating streaks:', err);
  }
}

function startStreakCron() {
  // Run at 11:59 PM every day
  cron.schedule('59 23 * * *', calculateStreaks);
  console.log('[Cron] Streak automation scheduled (daily at 23:59).');
  setTimeout(calculateStreaks, 10000); // Run once shortly after startup
}

module.exports = { startStreakCron, calculateStreaks };
