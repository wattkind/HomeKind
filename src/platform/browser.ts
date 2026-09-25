import { Browser } from '@capacitor/browser';

import { isNative } from './runtime';

/** Open a web page outside the app (in-app Safari view on iOS). Only called on user action. */
export async function openExternal(url: string): Promise<void> {
  if (isNative) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener');
}
