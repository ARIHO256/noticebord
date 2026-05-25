import Constants from 'expo-constants';
import { api } from '../api/client';

export async function registerForPushNotificationsAsync() {
  // Expo Go no longer supports registering for remote notifications.
  if (Constants.appOwnership === 'expo') {
    return;
  }
  try {
    const Notifications = await import('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.expoConfig?.extra?.projectId,
    });
    const token = tokenData.data;
    if (!token) {
      return;
    }
    await api.post('/users/register/register-device/', { token });
  } catch (error) {
    // Silently ignore push registration errors in development clients.
    if (__DEV__) {
      console.warn('Push registration skipped:', error);
    }
  }
}


