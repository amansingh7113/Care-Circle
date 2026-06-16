import { useEffect, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { syncSteps } from '../services/stepApi';

export default function StepTrackerService() {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const subscriptionRef = useRef(null);
  const lastSyncTimeRef = useRef(Date.now());
  const currentStepsRef = useRef(0);

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

        // Since Pedometer.watchStepCount only tracks steps since subscription, 
        // we start counting from 0 for this session. In a real production app, 
        // you would want to use Pedometer.getStepCountAsync to get the absolute daily steps.
        subscriptionRef.current = Pedometer.watchStepCount(result => {
          currentStepsRef.current = result.steps;
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
  }, []);

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
