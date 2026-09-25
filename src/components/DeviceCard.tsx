import { Link } from 'react-router-dom';

import type { Device } from '../types';
import { ChevronIcon } from './Icons';
import { WarrantyPill } from './WarrantyPill';

export function DeviceCard({ device, today }: { device: Device; today: Date }) {
  return (
    <Link to={`/devices/${device.id}`} className="card device-card">
      <span className="device-card__text">
        <span className="device-card__name">{device.name}</span>
        {device.room ? <span className="device-card__room">{device.room}</span> : null}
        <WarrantyPill device={device} today={today} />
      </span>
      <ChevronIcon className="device-card__chevron" />
    </Link>
  );
}

export function DeviceCardList({ devices, today }: { devices: Device[]; today: Date }) {
  return (
    <ul className="card-list">
      {devices.map((device) => (
        <li key={device.id}>
          <DeviceCard device={device} today={today} />
        </li>
      ))}
    </ul>
  );
}
