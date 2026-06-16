import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { savePushToken } from './notificationApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CareCircle Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#55A994',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'care-circle', // Will be resolved from app.json
    });
    const pushToken = tokenData.data;

    // Save token to backend
    await savePushToken(pushToken);
    return pushToken;
  } catch (error) {
    console.error('Push notification registration error:', error);
    return null;
  }
}

export function setupNotificationListeners(navigationRef) {
  // Handle notification when app is foregrounded
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Foreground notification:', notification);
  });

  // Handle notification tap
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === 'MISSED_DOSE_ALERT' && navigationRef?.isReady()) {
      navigationRef.navigate('MedicineTracker');
    }
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}
