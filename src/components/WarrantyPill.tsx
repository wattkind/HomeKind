import { daysUntilWarrantyEnd, warrantyStatus } from '../data/warranty';
import type { Device } from '../types';
import { formatIsoDate } from './format';

function warrantyText(device: Pick<Device, 'warrantyEndDate'>, today: Date): string | null {
  const status = warrantyStatus(device, today);
  switch (status) {
    case 'none':
      return null;
    case 'active':
      return `Warranty until ${formatIsoDate(device.warrantyEndDate)}`;
    case 'ending-soon': {
      const days = daysUntilWarrantyEnd(device, today) ?? 0;
      if (days <= 0) return 'Ends today';
      return days === 1 ? 'Ends in 1 day' : `Ends in ${days} days`;
    }
    case 'expired':
      return 'Warranty ended';
  }
}

export function WarrantyPill({
  device,
  today,
}: {
  device: Pick<Device, 'warrantyEndDate'>;
  today: Date;
}) {
  const text = warrantyText(device, today);
  if (!text) return null;
  const status = warrantyStatus(device, today);
  return <span className={`pill pill--${status}`}>{text}</span>;
}
