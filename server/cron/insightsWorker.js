const { parentPort } = require('worker_threads');
const { createClient } = require('@supabase/supabase-js');

let supabase;
function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL || 'https://tslppywdlbayvgtuqpqb.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_hk-qJ2c4QhQ5BCQIL1UYPg_8zRUg9Fl'
    );
  }
  return supabase;
}

async function processInsights() {
  parentPort.postMessage('Processing AI Insights (Heartbeat & Correlations)...');
  
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: circles, error: circlesError } = await getSupabase()
      .from('circles')
      .select('id');

    if (circlesError) throw circlesError;

    for (const circle of circles) {
      const circleId = circle.id;

      const { data: existing } = await getSupabase()
        .from('ai_insights_history')
        .select('id')
        .eq('circle_id', circleId)
        .is('prescription_id', null)
        .contains('insight_data', { type: 'heartbeat', period: today })
        .maybeSingle();

      if (existing) continue;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const since = sevenDaysAgo.toISOString();

      const [bpRes, medsRes, medsListRes] = await Promise.all([
        getSupabase().from('blood_pressure_logs').select('*').eq('circle_id', circleId).gte('logged_at', since).order('logged_at', { ascending: true }),
        getSupabase().from('medicine_dose_logs').select('*').eq('circle_id', circleId).gte('taken_at', since).order('taken_at', { ascending: true }),
        getSupabase().from('medicines').select('id, name').eq('circle_id', circleId)
      ]);

      const bpLogs = bpRes.data || [];
      const doseLogs = medsRes.data || [];
      const medicines = medsListRes.data || [];

      let healthScore = "Status Unknown";
      let status = "Unknown";
      let correlations = [];
      let missingData = false;

      if (bpLogs.length === 0 && doseLogs.length === 0) {
        missingData = true;
      } else {
        let score = 100;
        
        if (doseLogs.length > 0) {
          const taken = doseLogs.filter(log => log.status && log.status.toUpperCase() === 'TAKEN').length;
          const adherence = taken / doseLogs.length;
          if (adherence < 0.8) score -= 15;
          if (adherence < 0.5) score -= 20;
        }

        if (bpLogs.length > 0) {
          let highReadings = 0;
          for (const log of bpLogs) {
            if (log.systolic > 140 || log.diastolic > 90) highReadings++;
          }
          const highRatio = highReadings / bpLogs.length;
          if (highRatio > 0.5) score -= 20;
          else if (highRatio > 0.2) score -= 10;
        }

        healthScore = Math.max(0, score);
        if (healthScore >= 80) status = "Good";
        else if (healthScore >= 60) status = "Fair";
        else status = "Needs Attention";

        const overallSysAvg = bpLogs.reduce((sum, log) => sum + log.systolic, 0) / (bpLogs.length || 1);
        
        medicines.forEach(med => {
          const medDoses = doseLogs.filter(log => log.medicine_id === med.id && log.status && log.status.toUpperCase() === 'TAKEN' && log.taken_at);
          let postMedSysSum = 0;
          let postMedCount = 0;

          medDoses.forEach(dose => {
            const doseTime = new Date(dose.taken_at).getTime();
            bpLogs.forEach(bp => {
              const bpTime = new Date(bp.logged_at).getTime();
              const diffHours = (bpTime - doseTime) / (1000 * 60 * 60);
              if (diffHours > 0 && diffHours <= 4) {
                postMedSysSum += bp.systolic;
                postMedCount++;
              }
            });
          });

          if (postMedCount > 0 && bpLogs.length > postMedCount) {
            const postMedAvg = postMedSysSum / postMedCount;
            if (postMedAvg < overallSysAvg - 5) {
              correlations.push(`BP systolic typically drops by ~${Math.round(overallSysAvg - postMedAvg)} mmHg after taking ${med.name}.`);
            } else if (postMedAvg > overallSysAvg + 5) {
              correlations.push(`BP systolic remains elevated (~${Math.round(postMedAvg - overallSysAvg)} mmHg higher than average) after taking ${med.name}.`);
            }
          }
        });

        if (correlations.length === 0 && bpLogs.length > 0 && doseLogs.length > 0) {
          correlations.push("No significant BP deviations detected post-medication.");
        }
      }

      const insightData = {
        type: 'heartbeat', period: today, health_score: healthScore,
        status: status, correlations: correlations, missing_data: missingData
      };

      const { error: insertError } = await getSupabase()
        .from('ai_insights_history')
        .insert([{ circle_id: circleId, insight_data: insightData }]);

      if (insertError) parentPort.postMessage(`Error inserting insight for circle ${circleId}: ${insertError.message}`);
    }
    
    parentPort.postMessage('Insights Processing complete.');
  } catch (error) {
    parentPort.postMessage(`Error processing insights: ${error.message}`);
  }
}

processInsights();
