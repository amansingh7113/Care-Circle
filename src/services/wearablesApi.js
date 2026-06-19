import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';
import { Platform } from 'react-native';
import { syncSteps } from './stepApi'; // existing endpoint

export const syncWearableSteps = async (circleId) => {
  if (Platform.OS !== 'android') {
    throw new Error('Health Connect is only available on Android');
  }

  try {
    const isInitialized = await initialize();
    if (!isInitialized) throw new Error('Health Connect is not available');

    // Request permissions to read steps
    const permissions = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endTime = new Date();

    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: today.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    if (result && result.records) {
      // Aggregate total steps for today
      let totalSteps = 0;
      for (const record of result.records) {
        totalSteps += record.count || 0;
      }

      if (totalSteps > 0) {
        // Send to our backend endpoint
        const todayStr = new Date().toISOString().split('T')[0];
        await syncSteps(circleId, todayStr, totalSteps);
        return totalSteps;
      }
    }
    return 0;
  } catch (error) {
    console.error('Wearable sync error:', error);
    throw error;
  }
};
