import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginEmail, registerEmail } from '../services/authApi';
import { getMedicineAnalytics } from '../services/medicineApi';

export const useStore = create(
  persist(
    (set) => ({
      userSession: null,
      currentCircle: null,
      medicinesList: [],
      dailyTasks: [],
      bloodPressureLogs: [],
      sleepLogs: [],
      emailAuthLoading: false,
      emailAuthError: null,
      medicineAnalytics: null,
      analyticsLoading: false,

      setSession: (session) => set({ userSession: session }),
      clearSession: () => set({ userSession: null, currentCircle: null, medicinesList: [], dailyTasks: [], bloodPressureLogs: [], sleepLogs: [], medicineAnalytics: null, analyticsLoading: false }),
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
      loginWithEmail: async (email, password) => {
        set({ emailAuthLoading: true, emailAuthError: null });
        try {
          const data = await loginEmail(email, password);
          if (data.token) {
            await AsyncStorage.setItem('userToken', data.token);
            set({ userSession: data.token, emailAuthLoading: false });
            return data;
          }
        } catch (error) {
          set({ 
            emailAuthError: error.response?.data?.error || error.message || 'Login failed',
            emailAuthLoading: false 
          });
          throw error;
        }
      },
      registerWithEmail: async (email, password) => {
        set({ emailAuthLoading: true, emailAuthError: null });
        try {
          const data = await registerEmail(email, password);
          if (data.token) {
            await AsyncStorage.setItem('userToken', data.token);
            set({ userSession: data.token, emailAuthLoading: false });
            return data;
          }
        } catch (error) {
          set({ 
            emailAuthError: error.response?.data?.error || error.message || 'Registration failed',
            emailAuthLoading: false 
          });
          throw error;
        }
      },
      fetchMedicineAnalytics: async () => {
        set({ analyticsLoading: true });
        try {
          const data = await getMedicineAnalytics();
          set({ medicineAnalytics: data, analyticsLoading: false });
        } catch (error) {
          console.error('Failed to fetch medicine analytics:', error);
          set({ analyticsLoading: false });
        }
      },
    }),
    {
      name: 'care-circle-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
