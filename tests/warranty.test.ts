import { describe, expect, it } from 'vitest';
import {
  addYearsToIsoDate,
  daysUntilWarrantyEnd,
  endingSoonOrExpired,
  sortDevices,
  todayIsoDate,
  warrantyStatus,
} from '../src/data/warranty';
import type { Device } from '../src/types';

// Local midnight-ish and late evening, to catch time zone drift.
const today = new Date(2026, 8, 25, 23, 30);
const early = new Date(2026, 8, 25, 0, 5);

function device(name: string, warrantyEndDate?: string): Device {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    room: '',
    warrantyEndDate,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('warrantyStatus', () => {
  it.each([
    [undefined, 'none', null],
    ['2026-09-24', 'expired', -1],
    ['2026-09-25', 'ending-soon', 0],
    ['2026-12-24', 'ending-soon', 90],
    ['2026-12-25', 'active', 91],
    ['2030-01-01', 'active', 1194],
  ] as const)('%s -> %s', (end, status, days) => {
    for (const now of [today, early]) {
      expect(warrantyStatus({ warrantyEndDate: end }, now)).toBe(status);
      expect(daysUntilWarrantyEnd({ warrantyEndDate: end }, now)).toBe(days);
    }
  });

  it('treats an empty or malformed date as none', () => {
    expect(warrantyStatus({ warrantyEndDate: '' }, today)).toBe('none');
    expect(warrantyStatus({ warrantyEndDate: '2026-02-30' }, today)).toBe('none');
  });
});

describe('addYearsToIsoDate', () => {
  it('clamps 29 February into non-leap years', () => {
    expect(addYearsToIsoDate('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYearsToIsoDate('2024-02-29', 4)).toBe('2028-02-29');
  });

  it('adds plain years', () => {
    expect(addYearsToIsoDate('2026-09-25', 2)).toBe('2028-09-25');
    expect(addYearsToIsoDate('2026-12-31', 1)).toBe('2027-12-31');
  });

  it('rejects invalid input', () => {
    expect(() => addYearsToIsoDate('25/09/2026', 1)).toThrow();
  });
});

describe('todayIsoDate', () => {
  it('uses the local calendar date', () => {
    expect(todayIsoDate(today)).toBe('2026-09-25');
    expect(todayIsoDate(early)).toBe('2026-09-25');
    expect(todayIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('sortDevices', () => {
  const devices = [
    device('zebra fridge'),
    device('Active TV', '2028-01-01'),
    device('Old kettle', '2025-01-01'),
    device('Recent toaster', '2026-09-20'),
    device('Soon washer', '2026-12-01'),
    device('Today dryer', '2026-09-25'),
    device('apple mixer'),
    device('Also soon', '2026-12-01'),
  ];

  it('orders ending soon, then expired, then the rest by name', () => {
    expect(sortDevices(devices, today).map((d) => d.name)).toEqual([
      'Today dryer',
      'Also soon',
      'Soon washer',
      'Recent toaster',
      'Old kettle',
      'Active TV',
      'apple mixer',
      'zebra fridge',
    ]);
  });

  it('does not mutate the input', () => {
    const copy = [...devices];
    sortDevices(devices, today);
    expect(devices).toEqual(copy);
  });

  it('endingSoonOrExpired keeps only devices needing attention, in order', () => {
    expect(endingSoonOrExpired(devices, today).map((d) => d.name)).toEqual([
      'Today dryer',
      'Also soon',
      'Soon washer',
      'Recent toaster',
      'Old kettle',
    ]);
  });
});
