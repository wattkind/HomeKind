import { useState } from 'react';

import { errorMessage } from '../components/format';
import { ShareIcon, TrashIcon } from '../components/Icons';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Screen } from '../components/Screen';
import { BrandMark, WattKindWordmark, Wordmark } from '../components/Wordmark';
import {
  applyImport,
  deleteAllData,
  exportBackup,
  exportBackupToCache,
  planImport,
} from '../data/backup';
import { pickFile } from '../platform/files';
import { openExternal } from '../platform/browser';
import { isAndroid, isNative } from '../platform/runtime';
import { shareFile, shareUri } from '../platform/share';
import type { ImportPlan } from '../types';
import { APP_VERSION } from '../version';

const PRIVACY_URL = 'https://wattkind.ai/homekind/privacy';

type ImportResult = Awaited<ReturnType<typeof applyImport>>;

type RestoreState =
  | { step: 'idle' }
  | { step: 'plan'; plan: ImportPlan }
  | { step: 'applying'; plan: ImportPlan }
  | { step: 'done'; result: ImportResult };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function SettingsScreen() {
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [restore, setRestore] = useState<RestoreState>({ step: 'idle' });
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onBackup = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    setBackupError(null);
    try {
      let filename: string;
      let shared: boolean;
      if (isNative) {
        // Built on disk by native code; the web view never holds the attachments.
        const file = await exportBackupToCache();
        filename = file.filename;
        shared = await shareUri(filename, file.uri);
      } else {
        const file = await exportBackup();
        filename = file.filename;
        shared = await shareFile(filename, file.bytes, 'application/zip');
      }
      // A dismissed share sheet saved nothing, so say nothing rather than "ready".
      if (shared) setBackupStatus(`Backup ready: ${filename}`);
    } catch (error) {
      setBackupError(`The backup could not be made. ${errorMessage(error)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const onChooseBackup = async () => {
    setRestoreError(null);
    setRestoreBusy(true);
    try {
      const file = await pickFile('.zip,application/zip');
      if (!file) return;
      // The zip is streamed from the picked file, never loaded whole.
      const plan = await planImport(file);
      setRestore({ step: 'plan', plan });
    } catch (error) {
      setRestoreError(`That backup could not be read. ${errorMessage(error)}`);
    } finally {
      setRestoreBusy(false);
    }
  };

  const onApply = async (plan: ImportPlan, overwriteConflicts: boolean) => {
    setRestore({ step: 'applying', plan });
    try {
      const result = await applyImport(plan, { overwriteConflicts });
      setRestore({ step: 'done', result });
    } catch (error) {
      setRestore({ step: 'idle' });
      setRestoreError(`The backup could not be restored. ${errorMessage(error)}`);
    }
  };

  const onDeleteAll = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAllData();
      setDeleteOpen(false);
      setDeleteStatus('All devices, photos and documents have been deleted from this phone.');
    } catch (error) {
      setDeleteOpen(false);
      setDeleteError(`Could not delete everything. ${errorMessage(error)}`);
    } finally {
      setDeleteBusy(false);
    }
  };

  const plan = restore.step === 'plan' || restore.step === 'applying' ? restore.plan : null;
  const conflicts = plan?.conflicts.length ?? 0;
  const applying = restore.step === 'applying';
  const closeRestore = () => {
    if (!applying) setRestore({ step: 'idle' });
  };

  return (
    <Screen title="Settings">
      <section className="card settings-card" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="settings-card__title">
          Back up
        </h2>
        <p>
          Your devices, photos and documents are stored only on this phone. A backup file is the
          only way to get them back if you lose or replace your phone. Save it to{' '}
          {isAndroid ? 'Google Drive or your Files app' : 'iCloud Drive or the Files app'}, and make
          a new one after big changes.
        </p>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => void onBackup()}
          disabled={backupBusy}
        >
          <ShareIcon />
          {backupBusy ? 'Making backup' : 'Back up'}
        </button>
        <div aria-live="polite">
          {backupStatus ? <p className="alert alert--success">{backupStatus}</p> : null}
        </div>
        {backupError ? (
          <p className="alert alert--error" role="alert">
            {backupError}
          </p>
        ) : null}
      </section>

      <section className="card settings-card" aria-labelledby="restore-heading">
        <h2 id="restore-heading" className="settings-card__title">
          Restore from backup
        </h2>
        <p>Choose a HomeKind backup file. You will see what it contains before anything changes.</p>
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => void onChooseBackup()}
          disabled={restoreBusy}
        >
          Choose backup file
        </button>
        {restoreError ? (
          <p className="alert alert--error" role="alert">
            {restoreError}
          </p>
        ) : null}
      </section>

      <section className="card settings-card" aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="settings-card__title">
          Delete all data
        </h2>
        <p>Remove every device, photo and document from this phone.</p>
        <button
          type="button"
          className="btn btn--danger-quiet btn--block"
          onClick={() => {
            setDeleteStatus(null);
            setDeleteOpen(true);
          }}
        >
          <TrashIcon />
          Delete all data
        </button>
        <div aria-live="polite">
          {deleteStatus ? <p className="alert alert--success">{deleteStatus}</p> : null}
        </div>
        {deleteError ? (
          <p className="alert alert--error" role="alert">
            {deleteError}
          </p>
        ) : null}
      </section>

      <section className="card settings-card about" aria-labelledby="about-heading">
        <h2 id="about-heading" className="sr-only">
          About
        </h2>
        <BrandMark size={64} />
        <p className="about__name">
          <Wordmark /> <span className="about__by">by</span> <WattKindWordmark />
        </p>
        <p className="muted">Version {APP_VERSION}</p>
        <a
          href={PRIVACY_URL}
          className="text-link"
          onClick={(event) => {
            event.preventDefault();
            void openExternal(PRIVACY_URL);
          }}
        >
          Privacy statement
        </a>
      </section>

      <Modal
        open={plan !== null}
        title="Restore from backup"
        onClose={closeRestore}
        actions={
          plan ? (
            conflicts > 0 ? (
              <>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => void onApply(plan, false)}
                  disabled={applying}
                >
                  Keep mine
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void onApply(plan, true)}
                  disabled={applying}
                >
                  Replace with backup
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={closeRestore}
                  disabled={applying}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void onApply(plan, false)}
                  disabled={applying || plan.newDevices.length === 0}
                >
                  Restore
                </button>
              </>
            )
          ) : null
        }
      >
        {plan ? (
          <>
            <ul className="summary">
              <li>{plural(plan.newDevices.length, 'new device', 'new devices')}</li>
              <li>
                {plural(conflicts, 'device already on this phone', 'devices already on this phone')}
              </li>
            </ul>
            {conflicts > 0 ? (
              <p>
                Keep the versions on this phone, or replace them with the versions in the backup?
                Replacing also replaces their photos and documents.
              </p>
            ) : plan.newDevices.length === 0 ? (
              <p>There is nothing new in this backup.</p>
            ) : null}
            {plan.missingFiles.length > 0 ? (
              <p className="alert alert--warning">
                {plural(plan.missingFiles.length, 'file is', 'files are')} missing from the backup
                and will be skipped.
              </p>
            ) : null}
            {applying ? (
              <p className="muted" role="status">
                Restoring
              </p>
            ) : null}
            {conflicts > 0 && !applying ? (
              <button type="button" className="link-btn" onClick={closeRestore}>
                Cancel
              </button>
            ) : null}
          </>
        ) : null}
      </Modal>

      <Modal
        open={restore.step === 'done'}
        title="Backup restored"
        onClose={() => setRestore({ step: 'idle' })}
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setRestore({ step: 'idle' })}
          >
            Done
          </button>
        }
      >
        {restore.step === 'done' ? (
          <ul className="summary">
            <li>{plural(restore.result.devicesAdded, 'device added', 'devices added')}</li>
            {restore.result.devicesOverwritten > 0 ? (
              <li>
                {plural(restore.result.devicesOverwritten, 'device replaced', 'devices replaced')}
              </li>
            ) : null}
            {restore.result.devicesSkipped > 0 ? (
              <li>
                {plural(
                  restore.result.devicesSkipped,
                  'device kept as it was',
                  'devices kept as they were',
                )}
              </li>
            ) : null}
            <li>
              {plural(
                restore.result.attachmentsWritten,
                'photo or document restored',
                'photos and documents restored',
              )}
            </li>
          </ul>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete all data?"
        message="Every device, photo and document will be removed from this phone. If you have not made a backup, they cannot be recovered."
        confirmLabel="Delete everything"
        busy={deleteBusy}
        onConfirm={() => void onDeleteAll()}
        onCancel={() => setDeleteOpen(false)}
      />
    </Screen>
  );
}
