import Dexie, { type Table } from 'dexie';
import type { Attachment, Device } from '../types';

/** Record metadata only. Attachment bytes live in `src/storage`, never here. */
export class HomeKindDB extends Dexie {
  devices!: Table<Device, string>;
  attachments!: Table<Attachment, string>;

  constructor() {
    super('homekind');
    this.version(1).stores({
      devices: 'id, name, room, warrantyEndDate, updatedAt',
      attachments: 'id, deviceId, updatedAt',
    });
  }
}

export const db = new HomeKindDB();
