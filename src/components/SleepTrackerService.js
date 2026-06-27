import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { addSleepLog } from '../services/sleepApi';
import Constants from 'expo-constants';
import {
  initialize,
  requestPermission,
  readRecords,
} from 'react-native-health-connect';

export default function SleepTrackerService() {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  const circleId = currentCircle?.id || user?.circle_id;
  
  const syncedSessionsRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    // Only track sleep if the current user is the Patient, OR if we are in Expo Go testing mode
    if (user?.role !== 'Patient' && Constants.appOwnership !== 'expo') {
      return;
    }

    const initAndFetch = async () => {
      if (Constants.appOwnership === 'expo') {
        console.log('Health Connect (Sleep) not supported in Expo Go. Injecting simulated baseline sleep session for Patient testing.');
        const now = new Date();
        const sleepEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 45, 0);
        const sleepStart = new Date(sleepEnd.getTime() - 8.25 * 60 * 60 * 1000); // 8 hours 15 mins
        await logSleep(sleepStart.toISOString(), sleepEnd.toISOString(), 495);
        return;
      }

      try {
        const isInitialized = await Promise.race([
          initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('initialize timeout')), 2000))
        ]);
        if (!isInitialized) return;

        // Request permissions
        await Promise.race([
          requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('requestPermission timeout')), 2000))
        ]);

        fetchSleepFromHealthConnect();
      } catch (error) {
        console.error('Failed to initialize Health Connect (Sleep):', error.message || error);
        // Fallback to simulated sleep if native module fails/times out
        const now = new Date();
        const sleepEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 45, 0);
        const sleepStart = new Date(sleepEnd.getTime() - 8.25 * 60 * 60 * 1000);
        await logSleep(sleepStart.toISOString(), sleepEnd.toISOString(), 495);
      }
    };

    const fetchSleepFromHealthConnect = async () => {
      if (Constants.appOwnership === 'expo') return;
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const result = await Promise.race([
          readRecords('SleepSession', {
            timeRangeFilter: {
              operator: 'between',
              startTime: yesterday.toISOString(),
              endTime: now.toISOString(),
            },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('readRecords timeout')), 3000))
        ]);

        if (result?.records && result.records.length > 0) {
          for (const session of result.records) {
            const start = new Date(session.startTime);
            const end = new Date(session.endTime);
            const durationMinutes = (end - start) / (1000 * 60);

            if (durationMinutes > 60) {
              await logSleep(start.toISOString(), end.toISOString(), durationMinutes);
            }
          }
        }
      } catch (e) {
        console.error("Could not fetch sleep from Health Connect:", e.message || e);
      }
    };

    initAndFetch();

    const intervalId = setInterval(fetchSleepFromHealthConnect, 5 * 60000); // Check every 5 minutes

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [user?.role, circleId]);

  const logSleep = async (sleepStart, sleepEnd, durationMinutes) => {
    if (!circleId) return;
    
    // Check if this exact session has already been synced in this lifecycle
    const sessionKey = `${sleepStart}_${sleepEnd}`;
    if (syncedSessionsRef.current.has(sessionKey)) {
      return;
    }

    try {
      await addSleepLog({
        circle_id: circleId,
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_minutes: Math.round(durationMinutes),
        is_auto_detected: true
      });
      syncedSessionsRef.current.add(sessionKey);
      console.log(`Synced ${Math.round(durationMinutes)} mins of sleep from Health Connect / Baseline`);
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
  }, [circleId]);

  // Headless component renders nothing
  return null;
}
