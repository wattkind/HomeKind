/**
 * Dormant premium entitlement hook.
 *
 * HomeKind v1 is free and has no premium tier. A future paid tier (for example
 * "chat with your manuals") will replace this implementation with a real check.
 * Nothing else in the app should reference premium, and no premium UI exists.
 */
export function isPremium(): boolean {
  return false;
}
