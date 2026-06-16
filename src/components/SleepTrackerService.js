import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { addSleepLog } from '../services/sleepApi';

export default function SleepTrackerService() {
  const currentCircle = useStore(state => state.currentCircle);
  const user = useStore(state => state.user);
  
  const subscriptionRef = useRef(null);
  const isSleepingRef = useRef(false);
  const sleepStartTimeRef = useRef(null);
  const stillnessTimerRef = useRef(null);

  // Constants to define "stillness"
  const STILLNESS_THRESHOLD = 0.05; // Change in G-force
  const TIME_TO_FALL_ASLEEP = 30 * 60 * 1000; // 30 mins of stillness = asleep
  
  let lastVector = { x: 0, y: 0, z: 0 };

  useEffect(() => {
    let isMounted = true;

    // Only track sleep if the current user is the Patient
    if (user?.role !== 'Patient') {
      return;
    }

    const startTracking = async () => {
      try {
        const isAvailable = await Accelerometer.isAvailableAsync();
        if (!isAvailable || !isMounted) return;

        Accelerometer.setUpdateInterval(5000); // Check every 5 seconds to save battery
        
        subscriptionRef.current = Accelerometer.addListener(result => {
          const deltaX = Math.abs(result.x - lastVector.x);
          const deltaY = Math.abs(result.y - lastVector.y);
          const deltaZ = Math.abs(result.z - lastVector.z);
          
          lastVector = { x: result.x, y: result.y, z: result.z };

          const isMoving = (deltaX > STILLNESS_THRESHOLD || deltaY > STILLNESS_THRESHOLD || deltaZ > STILLNESS_THRESHOLD);

          if (isMoving) {
            // User moved
            if (isSleepingRef.current) {
               // Woke up
               isSleepingRef.current = false;
               const duration = (Date.now() - sleepStartTimeRef.current) / (1000 * 60); // minutes
               if (duration > 60) { // Log if slept for more than an hour
                 logSleep(duration);
               }
               sleepStartTimeRef.current = null;
            } else {
               // Reset the stillness timer
               if (stillnessTimerRef.current) clearTimeout(stillnessTimerRef.current);
               stillnessTimerRef.current = setTimeout(() => {
                 // After 30 mins of no movement, consider asleep
                 isSleepingRef.current = true;
                 sleepStartTimeRef.current = Date.now() - TIME_TO_FALL_ASLEEP;
               }, TIME_TO_FALL_ASLEEP);
            }
          }
        });

      } catch (error) {
        console.error('Failed to initialize sleep tracker:', error);
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (stillnessTimerRef.current) clearTimeout(stillnessTimerRef.current);
    };
  }, []);

  const logSleep = async (durationMinutes) => {
    if (!currentCircle) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await addSleepLog({
        circle_id: currentCircle.id,
        date: today,
        duration_minutes: Math.round(durationMinutes),
      });
      console.log(`Synced ${durationMinutes} mins of sleep`);
    } catch (error) {
      console.error('Failed to sync sleep log:', error);
    }
  };

  // Sync to backend on app backgrounding if they woke up and we haven't synced
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (
        nextAppState.match(/inactive|background/) && 
        currentCircle
      ) {
         // Optionally persist sleep state to storage so it survives app kill
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentCircle]);

  // Headless component renders nothing
  return null;
}
