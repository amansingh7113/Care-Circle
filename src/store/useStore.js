import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api';
import { loginEmail, registerEmail } from '../services/authApi';
import { getMedicineAnalytics } from '../services/medicineApi';
import { supabase } from '../services/supabase';
import { jwtDecode } from 'jwt-decode';

// Secure storage wrapper for sensitive Zustand persisted state (CC-012)
const secureStorage = {
  getItem: async (name) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch (e) {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (e) {}
  },
  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (e) {}
  },
};

export const useStore = create(
  persist(
    (set) => ({
      _hasHydrated: false,
      userSession: null,
      user: null,
      appLanguage: null, // Stores user's selected language
      currentCircle: null,
      medicinesList: [],
      dailyTasks: [],
      bloodPressureLogs: [],
      sleepLogs: [],
      stepLogs: [],
      emailAuthLoading: false,
      emailAuthError: null,
      medicineAnalytics: null,
      analyticsLoading: false,
      notifications: [],
      unreadNotificationCount: 0,
      pendingSyncQueue: [],
      lastHeartbeat: null,
      activeSubscription: null,

      setAppLanguage: (langCode) => set({ appLanguage: langCode }),
      setSession: (session) => {
        let decodedUser = null;
        if (session) {
          try { decodedUser = jwtDecode(session); } catch (e) {}
        }
        set({ userSession: session, user: decodedUser });
      },
      clearSession: () => {
        SecureStore.deleteItemAsync('userToken').catch(() => {});
        set({ userSession: null, user: null, currentCircle: null, medicinesList: [], dailyTasks: [], bloodPressureLogs: [], sleepLogs: [], medicineAnalytics: null, analyticsLoading: false, notifications: [], unreadNotificationCount: 0, pendingSyncQueue: [] });
      },
      setCircle: (circle) => set({ currentCircle: circle }),
      setMedicines: (medicines) => set({ medicinesList: medicines }),
      setBloodPressureLogs: (logs) => set({ bloodPressureLogs: logs }),
      addBloodPressureLog: (log) => set((state) => ({ bloodPressureLogs: [log, ...state.bloodPressureLogs] })),
      setSleepLogs: (logs) => set({ sleepLogs: logs }),
      setStepLogs: (logs) => set({ stepLogs: logs }),
      updateTaskStatus: (taskId, status) => set((state) => ({
        dailyTasks: state.dailyTasks.map(task =>
          task.id === taskId ? { ...task, status } : task
        )
      })),
      setNotifications: (notifications) => set({ notifications }),
      setUnreadCount: (count) => set({ unreadNotificationCount: count }),
      addToPendingSync: (mutation) => set((state) => ({ pendingSyncQueue: [...state.pendingSyncQueue, { ...mutation, id: Date.now().toString(), timestamp: new Date().toISOString() }] })),
      removePendingSync: (id) => set((state) => ({ pendingSyncQueue: state.pendingSyncQueue.filter(m => m.id !== id) })),
      flushPendingSync: async () => {
        const state = useStore.getState();
        if (state.pendingSyncQueue.length === 0) return;
        
        try {
          const netInfo = await NetInfo.fetch();
          if (!netInfo.isConnected) return;

          // Iterate over pending sync queue
          for (const item of state.pendingSyncQueue) {
            try {
              if (item.type === 'LOG_DOSE') {
                await api.post('/api/v1/medicines/log', item.payload);
              } else if (item.type === 'UPDATE_TASK') {
                await api.patch(`/api/v1/tasks/${item.payload.taskId}`, item.payload.data);
              }
              // Remove on success
              set((s) => ({ pendingSyncQueue: s.pendingSyncQueue.filter(m => m.id !== item.id) }));
            } catch (err) {
              console.warn('Failed to sync item:', item, err);
            }
          }
        } catch (error) {
          console.error('Flush sync error:', error);
        }
      },
      subscribeToCircle: (circleId) => {
        if (!circleId) return;
        set((state) => {
          if (state.activeSubscription) {
            supabase.removeChannel(state.activeSubscription);
          }
          return { activeSubscription: null };
        });
        
        const channel = supabase.channel(`circle_heartbeat_${circleId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `circle_id=eq.${circleId}` }, (payload) => {
            set({ lastHeartbeat: Date.now() });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'medicines', filter: `circle_id=eq.${circleId}` }, (payload) => {
            set({ lastHeartbeat: Date.now() });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_pressure_logs', filter: `circle_id=eq.${circleId}` }, (payload) => {
            set({ lastHeartbeat: Date.now() });
          })
          .subscribe();
          
        set({ activeSubscription: channel });
      },
      unsubscribeFromCircle: () => {
        set((state) => {
          if (state.activeSubscription) {
            supabase.removeChannel(state.activeSubscription);
          }
          return { activeSubscription: null };
        });
      },
      loginWithEmail: async (email, password) => {
        set({ emailAuthLoading: true, emailAuthError: null });
        try {
          const data = await loginEmail(email, password);
          if (data.token) {
            await SecureStore.setItemAsync('userToken', data.token);
            let decodedUser = null;
            try { decodedUser = jwtDecode(data.token); } catch(e){}
            set({ userSession: data.token, user: decodedUser, emailAuthLoading: false });
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
            await SecureStore.setItemAsync('userToken', data.token);
            let decodedUser = null;
            try { decodedUser = jwtDecode(data.token); } catch(e){}
            set({ userSession: data.token, user: decodedUser, emailAuthLoading: false });
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
      name: 'care-circle-secure-storage',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
      partialize: (state) => ({
        userSession: state.userSession,
        user: state.user,
        appLanguage: state.appLanguage,
        currentCircle: state.currentCircle,
        pendingSyncQueue: state.pendingSyncQueue,
        bloodPressureLogs: state.bloodPressureLogs,
        sleepLogs: state.sleepLogs,
        stepLogs: state.stepLogs
      }),
    }
  )
);
