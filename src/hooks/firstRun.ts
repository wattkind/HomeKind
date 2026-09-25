const KEY = 'homekind.firstRunDone';

/** In-memory fallback so the app still works for this session if storage is unavailable. */
let doneThisSession = false;

export function isFirstRunDone(): boolean {
  if (doneThisSession) return true;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunDone(): void {
  doneThisSession = true;
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Storage unavailable: the welcome screen will show again next launch.
  }
}
