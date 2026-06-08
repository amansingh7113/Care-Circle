import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useStore = create(
  persist(
    (set) => ({
      userSession: null,
      currentCircle: null,
      medicinesList: [],
      dailyTasks: [],
      bloodPressureLogs: [],
      sleepLogs: [],

      setSession: (session) => set({ userSession: session }),
      clearSession: () => set({ userSession: null, currentCircle: null, medicinesList: [], dailyTasks: [], bloodPressureLogs: [], sleepLogs: [] }),
      setCircle: (circle) => set({ currentCircle: circle }),
      setMedicines: (medicines) => set({ medicinesList: medicines }),
      setBloodPressureLogs: (logs) => set({ bloodPressureLogs: logs }),
      addBloodPressureLog: (log) => set((state) => ({ bloodPressureLogs: [log, ...state.bloodPressureLogs] })),
      setSleepLogs: (logs) => set({ sleepLogs: logs }),
      updateTaskStatus: (taskId, status) => set((state) => ({
        dailyTasks: state.dailyTasks.map(task =>
          task.id === taskId ? { ...task, status } : task
        )
      })),
    }),
    {
      name: 'care-circle-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
