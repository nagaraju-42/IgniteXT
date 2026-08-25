'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { FCM } from '@capacitor-community/fcm';

export function PushManager() {
  useEffect(() => {
    // Only run on Android/iOS natively
    if (Capacitor.isNativePlatform()) {
      registerPush();
    }
  }, []);

  const registerPush = async () => {
    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push notification permissions');
        return;
      }

      // Register with Apple / Google to receive token
      await PushNotifications.register();

      // Setup listeners
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        // Subscribe to the global topics for announcements
        try {
          await FCM.subscribeTo({ topic: 'all_students' });
          console.log('Subscribed to all_students topic');
        } catch (e) {
          console.error('Failed to subscribe to FCM topic:', e);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
        // You can show a custom toast here if you want in-app alerts
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push action performed: ' + JSON.stringify(action));
        // Redirect logic based on action.notification.data if needed
        const data = action.notification.data;
        if (data && data.ref_id && data.type) {
          const route = data.type === 'announcement' ? `/updates` : `/subject?id=${data.ref_id}`;
          window.location.href = route;
        }
      });

    } catch (error) {
      console.error('Error setting up Push Notifications:', error);
    }
  };

  return null; // This is a logic-only component
}
