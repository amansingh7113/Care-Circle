import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useStore } from '../store/useStore';
import { syncSteps } from '../services/stepApi';
import {
  initialize,
  requestPermission,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export default function StepTrackerService() {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  const setStepLogs = useStore(state => state.setStepLogs);
  const stepLogs = useStore(state => state.stepLogs);
  
  const currentStepsRef = useRef(0);
  const healthConnectBaseRef = useRef(0);
  const liveSessionStepsRef = useRef(0);
  const pedometerSubRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    if (user?.role !== 'Patient') {
      return;
    }

    const startTracking = async () => {
      let hcAvailable = false;
      
      // 1. Try to initialize Health Connect
      try {
        const status = await getSdkStatus();
        if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
          const isInitialized = await initialize();
          if (isInitialized) {
            await requestPermission([
              { accessType: 'read', recordType: 'Steps' },
            ]);
            hcAvailable = true;
          }
        }
      } catch (error) {
        console.log('Health Connect not available or permission denied:', error);
      }

      // 2. Fetch Base Steps
      await fetchBaseSteps(hcAvailable);

      // 3. Start Live Pedometer (for "every step" real-time syncing)
      try {
        const isPedometerAvailable = await Pedometer.isAvailableAsync();
        if (isPedometerAvailable && isMounted) {
          pedometerSubRef.current = Pedometer.watchStepCount(result => {
            liveSessionStepsRef.current = result.steps;
            updateTotalSteps();
          });
        }
      } catch (error) {
        console.error('Failed to start live pedometer:', error);
      }
    };

    const fetchBaseSteps = async (useHealthConnect) => {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      let baseSteps = 0;

      if (useHealthConnect) {
        try {
          const result = await readRecords('Steps', {
            timeRangeFilter: {
              operator: 'between',
              startTime: startOfDay.toISOString(),
              endTime: now.toISOString(),
            },
          });
          if (result?.records) {
            result.records.forEach(record => {
              baseSteps += record.count || 0;
            });
          }
        } catch (e) {
          console.error("Health Connect read failed:", e);
        }
      } else {
        // Fallback to Expo Pedometer history if no Health Connect
        try {
          const pastSteps = await Pedometer.getStepCountAsync(startOfDay, now);
          if (pastSteps) {
            baseSteps = pastSteps.steps;
          }
        } catch (e) {
          console.log("Expo Pedometer history failed:", e);
        }
      }

      healthConnectBaseRef.current = baseSteps;
      // Reset live session steps since we just got a fresh base
      liveSessionStepsRef.current = 0; 
      updateTotalSteps();
    };

    const updateTotalSteps = () => {
      const total = healthConnectBaseRef.current + liveSessionStepsRef.current;
      currentStepsRef.current = total;
      
      // Update local state for immediate UI feedback if needed
      // (Depends on how Dashboard reads steps, currently it reads from stepLogs)
    };

    startTracking();

    // Re-fetch base steps every 5 minutes in case Health Connect updated in background
    const intervalId = setInterval(() => {
      fetchBaseSteps(true).catch(() => fetchBaseSteps(false));
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (pedometerSubRef.current) {
        pedometerSubRef.current.remove();
      }
    };
  }, [user?.role]);

  // Sync to backend periodically or on backgrounding
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (
        nextAppState.match(/inactive|background/) && 
        currentCircle && 
        currentStepsRef.current > 0
      ) {
        const today = new Date().toISOString().split('T')[0];
        try {
          await syncSteps(currentCircle.id, today, currentStepsRef.current);
          console.log(`Synced ${currentStepsRef.current} steps for ${today}`);
        } catch (error) {
          console.error('Failed to sync steps on background:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentCircle]);

  return null;
}
