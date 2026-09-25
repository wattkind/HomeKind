import { useEffect, useState } from 'react';

import { readAttachmentBytes } from '../data/attachments';
import { bytesToBlob } from '../platform/bytes';
import { shareFile } from '../platform/share';
import type { Attachment } from '../types';
import { errorMessage } from './format';
import { CloseIcon, ShareIcon } from './Icons';
import { Modal } from './Modal';

/** Full-screen in-app viewer for one attachment. Object URLs are revoked on close. */
export function AttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBytes(null);
    setUrl(null);
    setError(null);
    if (!attachment) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    readAttachmentBytes(attachment)
      .then((data) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(bytesToBlob(data, attachment.mimeType));
        setBytes(data);
        setUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(`This file could not be opened. ${errorMessage(err)}`);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);

  const onShare = async () => {
    if (!attachment || !bytes) return;
    try {
      await shareFile(`${attachment.label}.${attachment.ext}`, bytes, attachment.mimeType);
    } catch (err) {
      setError(`Could not share this file. ${errorMessage(err)}`);
    }
  };

  return (
    <Modal
      open={attachment !== null}
      title={attachment?.label ?? ''}
      onClose={onClose}
      wide
      actions={
        <>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => void onShare()}
            disabled={!bytes}
          >
            <ShareIcon />
            Share
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            <CloseIcon />
            Close
          </button>
        </>
      }
    >
      {error ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : !url || !attachment ? (
        <p className="muted" role="status">
          Opening
        </p>
      ) : attachment.kind === 'photo' ? (
        <img className="viewer__image" src={url} alt={attachment.label} />
      ) : (
        <>
          <div className="viewer__pdf-wrap">
            <iframe className="viewer__pdf" src={url} title={attachment.label} />
          </div>
          <p className="field__hint">
            If the document does not show here, use Share to open it in another app.
          </p>
        </>
      )}
    </Modal>
  );
}
