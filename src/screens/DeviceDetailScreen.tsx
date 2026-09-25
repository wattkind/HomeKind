import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AttachmentViewer } from '../components/AttachmentViewer';
import { errorMessage, formatIsoDate, formatTimestamp } from '../components/format';
import { CameraIcon, DocumentIcon, TrashIcon } from '../components/Icons';
import { LabelDialog } from '../components/LabelDialog';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Screen } from '../components/Screen';
import { WarrantyPill } from '../components/WarrantyPill';
import { addAttachment, deleteAttachment, listAttachments } from '../data/attachments';
import { db } from '../data/db';
import { formatBytes } from '../platform/bytes';
import { takeOrPickPhoto } from '../platform/camera';
import { fileToBytes, pickFile } from '../platform/files';
import { isNative } from '../platform/runtime';
import type { Attachment, AttachmentKind } from '../types';

interface PendingFile {
  kind: AttachmentKind;
  bytes: Uint8Array;
  mimeType: string;
  ext: string;
  defaultLabel: string;
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim() || 'Document';
}

export function DeviceDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const device = useLiveQuery(async () => (await db.devices.get(id)) ?? null, [id]);
  const attachments = useLiveQuery(
    async () => (await listAttachments(id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [id],
  );
  const today = new Date();

  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);

  const back = { to: '/', label: 'Back to devices' };

  if (device === undefined) {
    return (
      <Screen title="Device" back={back}>
        <p className="muted" role="status">
          Loading
        </p>
      </Screen>
    );
  }

  if (device === null) {
    return (
      <Screen title="Device" back={back}>
        <p>This device could not be found. It may have been deleted.</p>
      </Screen>
    );
  }

  const addPhoto = async (source: 'camera' | 'library') => {
    setPhotoMenuOpen(false);
    setError(null);
    try {
      const photo = await takeOrPickPhoto(source);
      if (!photo) return;
      setSaveError(null);
      setPending({ kind: 'photo', ...photo, defaultLabel: 'Photo' });
    } catch (err) {
      setError(`Could not add the photo. ${errorMessage(err)}`);
    }
  };

  const addPdf = async () => {
    setError(null);
    try {
      const file = await pickFile('application/pdf');
      if (!file) return;
      if (file.type && file.type !== 'application/pdf') {
        setError('That file is not a PDF. Choose a PDF document.');
        return;
      }
      setSaveError(null);
      setPending({
        kind: 'pdf',
        bytes: await fileToBytes(file),
        mimeType: 'application/pdf',
        ext: 'pdf',
        defaultLabel: stripExtension(file.name),
      });
    } catch (err) {
      setError(`Could not add the PDF. ${errorMessage(err)}`);
    }
  };

  const savePending = async (label: string) => {
    if (!pending) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addAttachment({
        deviceId: device.id,
        kind: pending.kind,
        label,
        mimeType: pending.mimeType,
        ext: pending.ext,
        data: pending.bytes,
      });
      setPending(null);
    } catch (err) {
      setSaveError(`Could not save the file. ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await deleteAttachment(toDelete.id);
      setToDelete(null);
    } catch (err) {
      setToDelete(null);
      setError(`Could not delete the file. ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const details: Array<[string, string]> = [
    ['Room', device.room],
    ['Brand', device.brand ?? ''],
    ['Model', device.model ?? ''],
    ['Purchased', formatIsoDate(device.purchaseDate)],
    ['Warranty ends', formatIsoDate(device.warrantyEndDate)],
  ];
  const shownDetails = details.filter(([, value]) => value);

  return (
    <Screen
      title={device.name}
      back={back}
      action={
        <Link to={`/devices/${device.id}/edit`} className="btn btn--secondary btn--small">
          Edit
        </Link>
      }
    >
      <section className="card detail" aria-label="Details">
        <WarrantyPill device={device} today={today} />
        {shownDetails.length > 0 ? (
          <dl className="detail__list">
            {shownDetails.map(([term, value]) => (
              <div key={term} className="detail__row">
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">
            No other details yet. Use Edit to add a room, brand or warranty date.
          </p>
        )}
      </section>

      <section className="section" aria-labelledby="files-heading">
        <h2 id="files-heading" className="section__title">
          Photos and documents
        </h2>

        {error ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}

        {attachments && attachments.length > 0 ? (
          <ul className="card-list">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="card attachment">
                <button
                  type="button"
                  className="attachment__open"
                  onClick={() => setViewing(attachment)}
                >
                  <span className="attachment__icon">
                    {attachment.kind === 'photo' ? <CameraIcon /> : <DocumentIcon />}
                  </span>
                  <span className="attachment__text">
                    <span className="attachment__label">{attachment.label}</span>
                    <span className="attachment__meta">
                      {attachment.kind === 'photo' ? 'Photo' : 'PDF'} ·{' '}
                      {formatBytes(attachment.byteSize)} · {formatTimestamp(attachment.createdAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete ${attachment.label}`}
                  onClick={() => setToDelete(attachment)}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        ) : attachments ? (
          <p className="muted">Add a photo of the device or its receipt, or a PDF manual.</p>
        ) : null}

        <div className="button-row">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => (isNative ? setPhotoMenuOpen(true) : void addPhoto('library'))}
          >
            <CameraIcon />
            Add photo
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => void addPdf()}>
            <DocumentIcon />
            Add PDF
          </button>
        </div>
      </section>

      <Modal
        open={photoMenuOpen}
        title="Add photo"
        onClose={() => setPhotoMenuOpen(false)}
        actions={
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setPhotoMenuOpen(false)}
          >
            Cancel
          </button>
        }
      >
        <div className="menu">
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => void addPhoto('camera')}
          >
            Take photo
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => void addPhoto('library')}
          >
            Choose from library
          </button>
        </div>
      </Modal>

      <LabelDialog
        open={pending !== null}
        defaultLabel={pending?.defaultLabel ?? ''}
        busy={saving}
        error={saveError}
        onSave={(label) => void savePending(label)}
        onCancel={() => setPending(null)}
      />

      <AttachmentViewer attachment={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.label ?? 'file'}?`}
        message="This file will be removed from this phone. This cannot be undone."
        confirmLabel="Delete file"
        busy={saving}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}
