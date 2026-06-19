const cron = require('node-cron');
const { Worker } = require('worker_threads');
const path = require('path');

function processInsights() {
  console.log('[Cron] Spawning worker to process AI Insights...');
  const worker = new Worker(path.join(__dirname, 'insightsWorker.js'));

  worker.on('message', (msg) => {
    console.log('[Cron Worker Message]:', msg);
  });

  worker.on('error', (err) => {
    console.error('[Cron Worker Error]:', err);
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[Cron Worker] Stopped with exit code ${code}`);
    } else {
      console.log(`[Cron Worker] Completed successfully.`);
    }
  });
}

function startInsightsCron() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', processInsights);
  console.log('[Cron] Insights heartbeat scheduled (daily).');
  
  // Also run immediately on startup to catch up
  setTimeout(processInsights, 8000);
}

module.exports = { startInsightsCron, processInsights };
