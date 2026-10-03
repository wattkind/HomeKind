import { App } from '@capacitor/app';

import { isAndroid } from './runtime';

export type BackAction = 'close-dialog' | 'go-back' | 'leave-app';

/**
 * What the Android hardware/gesture back should do. Pure, so it is unit-tested;
 * `installBackButtonHandler` wires it to the real app.
 *
 * - an open `<dialog>` closes first (the same path as its Cancel button or Escape);
 * - otherwise the router goes back one entry;
 * - at the start of history (the device list, or the welcome screen) back leaves the
 *   app the way Android expects, by sending it to the background, not by killing it.
 */
export function decideBackAction(input: { hasOpenDialog: boolean; atRoot: boolean }): BackAction {
  if (input.hasOpenDialog) return 'close-dialog';
  if (input.atRoot) return 'leave-app';
  return 'go-back';
}

/** True when the router's history index is at its first entry. */
export function isAtHistoryRoot(): boolean {
  // react-router stores its history index in `history.state.idx`; 0 (or absent) is the
  // first entry since the app launched.
  const state = window.history.state as { idx?: number } | null;
  return !state || !state.idx;
}

/**
 * Android only. Without a listener Capacitor's default is to walk the web view's own
 * history and then exit the activity, which ignores open dialogs and skips the router.
 * Registering a listener replaces that default entirely.
 */
export function installBackButtonHandler(goBack: () => void): void {
  if (!isAndroid) return;
  void App.addListener('backButton', () => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    const action = decideBackAction({ hasOpenDialog: dialog !== null, atRoot: isAtHistoryRoot() });
    switch (action) {
      case 'close-dialog':
        // Modal.tsx listens for `cancel` (what Escape fires) and calls its onClose.
        dialog?.dispatchEvent(new Event('cancel', { cancelable: true }));
        return;
      case 'go-back':
        goBack();
        return;
      case 'leave-app':
        void App.minimizeApp();
    }
  });
}
