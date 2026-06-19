import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { addSleepLog } from '../services/sleepApi';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

export default function SleepTrackerService() {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const syncedSessionsRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    // Only track sleep if the current user is the Patient
    if (user?.role !== 'Patient') {
      return;
    }

    const initAndFetch = async () => {
      try {
        const isInitialized = await initialize();
        if (!isInitialized) return;

        // Request permissions
        await requestPermission([
          { accessType: 'read', recordType: 'SleepSession' },
        ]);

        fetchSleepFromHealthConnect();
      } catch (error) {
        console.error('Failed to initialize Health Connect (Sleep):', error);
      }
    };

    const fetchSleepFromHealthConnect = async () => {
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const result = await readRecords('SleepSession', {
          timeRangeFilter: {
            operator: 'between',
            startTime: yesterday.toISOString(),
            endTime: now.toISOString(),
          },
        });

        if (result?.records && result.records.length > 0) {
          // Process records to sync latest
          // We assume we want to sync any recent sleep sessions
          for (const session of result.records) {
            const start = new Date(session.startTime);
            const end = new Date(session.endTime);
            const durationMinutes = (end - start) / (1000 * 60);

            // Avoid syncing extremely short sessions or if we already synced recently
            // In a real app we would check backend if this exact session is synced
            if (durationMinutes > 60) {
              await logSleep(start.toISOString(), end.toISOString(), durationMinutes);
            }
          }
        }
      } catch (e) {
        console.error("Could not fetch sleep from Health Connect:", e);
      }
    };

    initAndFetch();

    // Fetch periodically while active
    const intervalId = setInterval(fetchSleepFromHealthConnect, 5 * 60000); // Check every 5 minutes

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [user?.role]);

  const logSleep = async (sleepStart, sleepEnd, durationMinutes) => {
    if (!currentCircle) return;
    
    // Check if this exact session has already been synced in this lifecycle
    const sessionKey = `${sleepStart}_${sleepEnd}`;
    if (syncedSessionsRef.current.has(sessionKey)) {
      return;
    }

    try {
      await addSleepLog({
        circle_id: currentCircle.id,
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_minutes: Math.round(durationMinutes),
        is_auto_detected: true
      });
      syncedSessionsRef.current.add(sessionKey);
      console.log(`Synced ${Math.round(durationMinutes)} mins of sleep from Health Connect`);
    } catch (error) {
      console.error('Failed to sync sleep log:', error);
    }
  };

  // Sync to backend on app backgrounding
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      // Logic for background handling if needed
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentCircle]);

  // Headless component renders nothing
  return null;
}
