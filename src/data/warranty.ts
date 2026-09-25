import { ENDING_SOON_DAYS } from '../types';
import type { Device, IsoDate, WarrantyStatus } from '../types';

/*
 * All comparisons happen on whole calendar days. A `YYYY-MM-DD` string is turned
 * into a day number via Date.UTC, and "today" is the caller's LOCAL calendar date
 * turned into a day number the same way, so time zones never shift a result.
 */

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(date: IsoDate): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayNumber(y: number, m: number, d: number): number {
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

function localDayNumber(today: Date): number {
  return dayNumber(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** Whole days from today to the warranty end date; negative once expired. Null when unset. */
export function daysUntilWarrantyEnd(
  device: Pick<Device, 'warrantyEndDate'>,
  today: Date,
): number | null {
  if (!device.warrantyEndDate) return null;
  const end = parseIsoDate(device.warrantyEndDate);
  if (!end) return null;
  return dayNumber(end.y, end.m, end.d) - localDayNumber(today);
}

export function warrantyStatus(
  device: Pick<Device, 'warrantyEndDate'>,
  today: Date,
): WarrantyStatus {
  const days = daysUntilWarrantyEnd(device, today);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= ENDING_SOON_DAYS) return 'ending-soon';
  return 'active';
}

function byName(a: Device, b: Device): number {
  return (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id)
  );
}

/** Ending soon (soonest first), then expired (most recent first), then the rest by name. */
export function sortDevices(devices: Device[], today: Date): Device[] {
  const rank = (status: WarrantyStatus): number =>
    status === 'ending-soon' ? 0 : status === 'expired' ? 1 : 2;

  const keyed = devices.map((device) => ({
    device,
    status: warrantyStatus(device, today),
    days: daysUntilWarrantyEnd(device, today) ?? 0,
  }));

  keyed.sort((a, b) => {
    const byRank = rank(a.status) - rank(b.status);
    if (byRank !== 0) return byRank;
    if (a.status === 'ending-soon' && a.days !== b.days) return a.days - b.days;
    if (a.status === 'expired' && a.days !== b.days) return b.days - a.days;
    return byName(a.device, b.device);
  });

  return keyed.map((k) => k.device);
}

/** Devices that need attention, in `sortDevices` order. */
export function endingSoonOrExpired(devices: Device[], today: Date): Device[] {
  return sortDevices(devices, today).filter((device) => {
    const status = warrantyStatus(device, today);
    return status === 'ending-soon' || status === 'expired';
  });
}

/** Adds whole years, clamping to the month's last day (2024-02-29 + 1y = 2025-02-28). */
export function addYearsToIsoDate(date: IsoDate, years: number): IsoDate {
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error(`Invalid date: ${date}`);
  const y = parsed.y + years;
  const d = Math.min(parsed.d, daysInMonth(y, parsed.m));
  return `${pad(y, 4)}-${pad(parsed.m)}-${pad(d)}`;
}

/** The local calendar date as `YYYY-MM-DD`. */
export function todayIsoDate(now: Date = new Date()): IsoDate {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
