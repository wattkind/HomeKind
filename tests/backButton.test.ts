import { describe, expect, it } from 'vitest';

import { decideBackAction } from '../src/platform/backButton';

describe('decideBackAction', () => {
  it('closes an open dialog before anything else', () => {
    expect(decideBackAction({ hasOpenDialog: true, atRoot: true })).toBe('close-dialog');
    expect(decideBackAction({ hasOpenDialog: true, atRoot: false })).toBe('close-dialog');
  });

  it('goes back through the router when there is history', () => {
    expect(decideBackAction({ hasOpenDialog: false, atRoot: false })).toBe('go-back');
  });

  it('leaves the app at the root of history', () => {
    expect(decideBackAction({ hasOpenDialog: false, atRoot: true })).toBe('leave-app');
  });
});
