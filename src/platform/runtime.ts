import { Capacitor } from '@capacitor/core';

/** True inside the iOS app shell; false in a plain browser (development). */
export const isNative: boolean = Capacitor.isNativePlatform();
