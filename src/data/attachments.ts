import { getStorage } from '../storage';
import type { Attachment, AttachmentKind } from '../types';
import { db } from './db';
import { newId, nowIso } from './ids';

export interface NewAttachment {
  deviceId: string;
  kind: AttachmentKind;
  label: string;
  mimeType: string;
  ext: string;
  data: Uint8Array;
}

/** Writes the bytes first, so a failed write never leaves a record without a file. */
export async function addAttachment(input: NewAttachment): Promise<Attachment> {
  const { data, ...meta } = input;
  const now = nowIso();
  const attachment: Attachment = {
    ...meta,
    id: newId(),
    label: meta.label.trim(),
    ext: meta.ext.toLowerCase(),
    byteSize: data.byteLength,
    createdAt: now,
    updatedAt: now,
  };
  await getStorage().write(attachment.deviceId, attachment.id, attachment.ext, data);
  try {
    await db.attachments.add(attachment);
  } catch (error) {
    await getStorage().delete(attachment.deviceId, attachment.id, attachment.ext);
    throw error;
  }
  return attachment;
}

/** Oldest first. */
export async function listAttachments(deviceId: string): Promise<Attachment[]> {
  const list = await db.attachments.where('deviceId').equals(deviceId).toArray();
  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function readAttachmentBytes(attachment: Attachment): Promise<Uint8Array> {
  return getStorage().read(attachment.deviceId, attachment.id, attachment.ext);
}

/** Removes the record, then the file. Missing ids are ignored. */
export async function deleteAttachment(id: string): Promise<void> {
  const attachment = await db.attachments.get(id);
  if (!attachment) return;
  await db.attachments.delete(id);
  await getStorage().delete(attachment.deviceId, attachment.id, attachment.ext);
}
