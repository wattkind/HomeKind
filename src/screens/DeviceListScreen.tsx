import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';

import { DeviceCardList } from '../components/DeviceCard';
import { PlusIcon } from '../components/Icons';
import { Screen } from '../components/Screen';
import { db } from '../data/db';
import { sortDevices } from '../data/warranty';

export function DeviceListScreen() {
  const devices = useLiveQuery(() => db.devices.toArray(), []);
  const today = new Date();

  return (
    <Screen title="Devices">
      {devices === undefined ? (
        <p className="muted" role="status">
          Loading
        </p>
      ) : devices.length === 0 ? (
        <div className="empty">
          <p className="empty__text">
            Add the appliances and gadgets in your home to keep their details, manuals and
            warranties in one place.
          </p>
          <Link to="/devices/new" className="btn btn--primary">
            <PlusIcon />
            Add your first device
          </Link>
        </div>
      ) : (
        <>
          <DeviceCardList devices={sortDevices(devices, today)} today={today} />
          <Link to="/devices/new" className="btn btn--primary fab">
            <PlusIcon />
            Add device
          </Link>
        </>
      )}
    </Screen>
  );
}
