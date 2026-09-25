import { useLiveQuery } from 'dexie-react-hooks';

import { DeviceCardList } from '../components/DeviceCard';
import { Screen } from '../components/Screen';
import { db } from '../data/db';
import { endingSoonOrExpired, warrantyStatus } from '../data/warranty';
import { ENDING_SOON_DAYS } from '../types';

export function WarrantiesScreen() {
  const devices = useLiveQuery(() => db.devices.toArray(), []);
  const today = new Date();

  if (devices === undefined) {
    return (
      <Screen title="Warranties">
        <p className="muted" role="status">
          Loading
        </p>
      </Screen>
    );
  }

  const relevant = endingSoonOrExpired(devices, today);
  const endingSoon = relevant.filter((d) => warrantyStatus(d, today) === 'ending-soon');
  const expired = relevant.filter((d) => warrantyStatus(d, today) === 'expired');

  return (
    <Screen title="Warranties">
      {relevant.length === 0 ? (
        <div className="empty">
          <p className="empty__text">
            No warranties end in the next {ENDING_SOON_DAYS} days, and none have ended. Add a
            warranty end date to a device to see it here.
          </p>
        </div>
      ) : (
        <>
          {endingSoon.length > 0 ? (
            <section className="section" aria-labelledby="ending-soon-heading">
              <h2 id="ending-soon-heading" className="section__title">
                Ending soon
              </h2>
              <DeviceCardList devices={endingSoon} today={today} />
            </section>
          ) : null}
          {expired.length > 0 ? (
            <section className="section" aria-labelledby="expired-heading">
              <h2 id="expired-heading" className="section__title">
                Expired
              </h2>
              <DeviceCardList devices={expired} today={today} />
            </section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
