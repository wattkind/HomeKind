import { useEffect, useState } from 'react';

import { readAttachmentBytes } from '../data/attachments';
import { bytesToBlob } from '../platform/bytes';
import { shareFile } from '../platform/share';
import type { Attachment } from '../types';
import { errorMessage } from './format';
import { CloseIcon, ShareIcon } from './Icons';
import { Modal } from './Modal';
import { PdfPages } from './PdfPages';

/**
 * Full-screen in-app viewer for one attachment. Photos show as an image (the
 * object URL is revoked on close); PDFs render page by page with pdf.js.
 */
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
        if (attachment.kind === 'photo') {
          objectUrl = URL.createObjectURL(bytesToBlob(data, attachment.mimeType));
          setUrl(objectUrl);
        }
        setBytes(data);
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
      ) : !bytes || !attachment ? (
        <p className="muted" role="status">
          Opening
        </p>
      ) : attachment.kind === 'photo' ? (
        url ? (
          <img className="viewer__image" src={url} alt={attachment.label} />
        ) : null
      ) : (
        <>
          <PdfPages
            bytes={bytes}
            label={attachment.label}
            onError={(err) => setError(`This file could not be opened. ${errorMessage(err)}`)}
          />
          <p className="field__hint">
            If the document does not show here, use Share to open it in another app.
          </p>
        </>
      )}
    </Modal>
  );
}
