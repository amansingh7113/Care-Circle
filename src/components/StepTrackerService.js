import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useStore } from '../store/useStore';
import { syncSteps } from '../services/stepApi';
import Constants from 'expo-constants';
import {
  initialize,
  requestPermission,
  aggregateRecord,
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

    if (user?.role !== 'Patient' && Constants.appOwnership !== 'expo') {
      return;
    }

    const startTracking = async () => {
      let hcAvailable = false;
      
      // 1. Try to initialize Health Connect
      if (Constants.appOwnership !== 'expo') {
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
      }

      // Request Expo Pedometer permissions as fallback/live tracker
      try {
        await Pedometer.requestPermissionsAsync();
      } catch (permErr) {
        console.log('Pedometer perm request failed:', permErr);
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

      if (useHealthConnect && Constants.appOwnership !== 'expo') {
        try {
          const result = await aggregateRecord({
            recordType: 'Steps',
            timeRangeFilter: {
              operator: 'between',
              startTime: startOfDay.toISOString(),
              endTime: now.toISOString(),
            },
          });
          if (result?.COUNT_TOTAL) {
            baseSteps = result.COUNT_TOTAL;
          }
        } catch (e) {
          console.error("Health Connect read failed:", e);
        }
      } else {
        // Fallback to Expo Pedometer history if no Health Connect
        try {
          const pastSteps = await Promise.race([
            Pedometer.getStepCountAsync(startOfDay, now),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Pedometer timeout')), 1500))
          ]);
          if (pastSteps && pastSteps.steps > 0) {
            baseSteps = pastSteps.steps;
          } else {
            baseSteps = 5420; // Simulated baseline steps for Expo Go testing
          }
        } catch (e) {
          console.log("Expo Pedometer history failed/timeout:", e.message);
          baseSteps = 5420;
        }
      }

      healthConnectBaseRef.current = baseSteps;
      // Reset live session steps since we just got a fresh base
      liveSessionStepsRef.current = 0; 
      updateTotalSteps();
    };

    const updateTotalSteps = async () => {
      const total = healthConnectBaseRef.current + liveSessionStepsRef.current;
      currentStepsRef.current = total;
      
      const today = new Date().toISOString().split('T')[0];
      const currentLogs = useStore.getState().stepLogs || [];
      const index = currentLogs.findIndex(s => s.date === today);
      
      if (index !== -1) {
        if (total > currentLogs[index].step_count || currentLogs[index].step_count === undefined) {
          const newLogs = [...currentLogs];
          newLogs[index] = { ...newLogs[index], step_count: total };
          useStore.getState().setStepLogs(newLogs);
        }
      } else {
        useStore.getState().setStepLogs([{ date: today, step_count: total }, ...currentLogs]);
      }

      // Sync to backend immediately
      const circleId = useStore.getState().currentCircle?.id || useStore.getState().user?.circle_id;
      if (circleId && total > 0) {
        try {
          await syncSteps(circleId, today, total);
        } catch (err) {
          console.error("Initial step sync failed:", err);
        }
      }
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
      const activeCircleId = currentCircle?.id || user?.circle_id;
      if (
        nextAppState.match(/inactive|background/) && 
        activeCircleId && 
        currentStepsRef.current > 0
      ) {
        const today = new Date().toISOString().split('T')[0];
        try {
          await syncSteps(activeCircleId, today, currentStepsRef.current);
          console.log(`Synced ${currentStepsRef.current} steps for ${today}`);
        } catch (error) {
          console.error('Failed to sync steps on background:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentCircle, user]);

  return null;
}
