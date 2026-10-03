import { Capacitor } from '@capacitor/core';

/** True inside the iOS or Android app shell; false in a plain browser (development). */
export const isNative: boolean = Capacitor.isNativePlatform();

/** `'ios'`, `'android'` or `'web'`. Only used to pick platform-specific wording. */
export const platform: 'ios' | 'android' | 'web' = Capacitor.getPlatform() as
  'ios' | 'android' | 'web';

/**
 * Android wording. True in the Android app shell, and also in a plain browser on an
 * Android device (development, and the store screenshot renders), where the same
 * "Google Drive or your Files app" wording is the right one.
 */
export const isAndroid: boolean =
  platform === 'android' ||
  (platform === 'web' &&
    typeof navigator !== 'undefined' &&
    /\bAndroid\b/.test(navigator.userAgent));
