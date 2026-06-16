import { useEffect, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { syncSteps } from '../services/stepApi';

export default function StepTrackerService() {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const subscriptionRef = useRef(null);
  const currentStepsRef = useRef(0);
  const baseStepsRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    // Only track steps if the current user is the Patient
    if (user?.role !== 'Patient') {
      return;
    }

    const startTracking = async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (!isAvailable || !isMounted) return;

        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        
        try {
          const pastSteps = await Pedometer.getStepCountAsync(start, end);
          if (pastSteps) {
            baseStepsRef.current = pastSteps.steps;
            currentStepsRef.current = pastSteps.steps;
          }
        } catch (e) {
          console.warn("Could not get past steps, starting from 0:", e);
        }

        subscriptionRef.current = Pedometer.watchStepCount(result => {
          currentStepsRef.current = baseStepsRef.current + result.steps;
        });

      } catch (error) {
        console.error('Failed to initialize pedometer:', error);
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [user?.role]);

  // Sync to backend periodically or on app backgrounding
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (
        nextAppState.match(/inactive|background/) && 
        currentCircle && 
        currentStepsRef.current > 0
      ) {
        // App is going to background, do a quick sync
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

  // Headless component renders nothing
  return null;
}
