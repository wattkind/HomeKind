import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { errorMessage } from '../components/format';
import { TrashIcon } from '../components/Icons';
import { ConfirmDialog } from '../components/Modal';
import { Screen } from '../components/Screen';
import {
  createDevice,
  deleteDevice,
  getDevice,
  listRooms,
  updateDevice,
  type DeviceInput,
} from '../data/devices';
import { addYearsToIsoDate } from '../data/warranty';
import type { Device } from '../types';

const YEAR_OPTIONS = [1, 2, 3, 5] as const;

interface FormState {
  name: string;
  room: string;
  brand: string;
  model: string;
  purchaseDate: string;
  warrantyEndDate: string;
}

const EMPTY: FormState = {
  name: '',
  room: '',
  brand: '',
  model: '',
  purchaseDate: '',
  warrantyEndDate: '',
};

function toState(device: Device): FormState {
  return {
    name: device.name,
    room: device.room,
    brand: device.brand ?? '',
    model: device.model ?? '',
    purchaseDate: device.purchaseDate ?? '',
    warrantyEndDate: device.warrantyEndDate ?? '',
  };
}

function toInput(state: FormState): DeviceInput {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    name: state.name.trim(),
    room: state.room.trim(),
    brand: optional(state.brand),
    model: optional(state.model),
    purchaseDate: optional(state.purchaseDate),
    warrantyEndDate: optional(state.warrantyEndDate),
  };
}

export function DeviceFormScreen() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [existing, setExisting] = useState<Device | null | undefined>(isEdit ? undefined : null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRooms()
      .then((r) => {
        if (!cancelled) setRooms(r);
      })
      .catch(() => undefined);
    if (id) {
      getDevice(id)
        .then((device) => {
          if (cancelled) return;
          setExisting(device ?? null);
          if (device) setForm(toState(device));
        })
        .catch(() => {
          if (!cancelled) setExisting(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'name') {
      setNameTouched(true);
      if (value.trim()) setNameError(null);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setNameError('Enter a name for this device.');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input = toInput(form);
      if (id) {
        await updateDevice(id, input);
        navigate(`/devices/${id}`, { replace: true });
      } else {
        const created = await createDevice(input);
        navigate(`/devices/${created.id}`, { replace: true });
      }
    } catch (error) {
      setSaveError(`Could not save. ${errorMessage(error)}`);
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await deleteDevice(id);
      navigate('/', { replace: true });
    } catch (error) {
      setConfirmDelete(false);
      setSaveError(`Could not delete. ${errorMessage(error)}`);
      setSaving(false);
    }
  };

  const title = isEdit ? 'Edit device' : 'Add device';
  const back = isEdit
    ? { to: `/devices/${id}`, label: 'Back to device' }
    : { to: '/', label: 'Back to devices' };

  if (isEdit && existing === undefined) {
    return (
      <Screen title={title} back={back}>
        <p className="muted" role="status">
          Loading
        </p>
      </Screen>
    );
  }

  if (isEdit && existing === null) {
    return (
      <Screen title={title} back={{ to: '/', label: 'Back to devices' }}>
        <p>This device could not be found. It may have been deleted.</p>
        <p>
          <Link to="/">Back to devices</Link>
        </p>
      </Screen>
    );
  }

  const ids = {
    name: `${uid}-name`,
    nameError: `${uid}-name-error`,
    room: `${uid}-room`,
    rooms: `${uid}-rooms`,
    brand: `${uid}-brand`,
    model: `${uid}-model`,
    purchase: `${uid}-purchase`,
    warranty: `${uid}-warranty`,
    warrantyHint: `${uid}-warranty-hint`,
  };
  const hasPurchase = Boolean(form.purchaseDate);

  return (
    <Screen title={title} back={back}>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={ids.name} className="field__label">
            Name
          </label>
          <input
            ref={nameRef}
            id={ids.name}
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            onBlur={() => {
              if (nameTouched && !form.name.trim()) setNameError('Enter a name for this device.');
            }}
            placeholder="For example, Dishwasher"
            autoComplete="off"
            required
            aria-required="true"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? ids.nameError : undefined}
          />
          {nameError ? (
            <p id={ids.nameError} className="field__error">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={ids.room} className="field__label">
            Room <span className="field__optional">(optional)</span>
          </label>
          <input
            id={ids.room}
            className="input"
            type="text"
            list={ids.rooms}
            value={form.room}
            onChange={(e) => set('room')(e.target.value)}
            placeholder="For example, Kitchen"
            autoComplete="off"
          />
          <datalist id={ids.rooms}>
            {rooms.map((room) => (
              <option key={room} value={room} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor={ids.brand} className="field__label">
            Brand <span className="field__optional">(optional)</span>
          </label>
          <input
            id={ids.brand}
            className="input"
            type="text"
            value={form.brand}
            onChange={(e) => set('brand')(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor={ids.model} className="field__label">
            Model <span className="field__optional">(optional)</span>
          </label>
          <input
            id={ids.model}
            className="input"
            type="text"
            value={form.model}
            onChange={(e) => set('model')(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor={ids.purchase} className="field__label">
            Purchase date <span className="field__optional">(optional)</span>
          </label>
          <input
            id={ids.purchase}
            className="input"
            type="date"
            value={form.purchaseDate}
            onChange={(e) => set('purchaseDate')(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor={ids.warranty} className="field__label">
            Warranty end date <span className="field__optional">(optional)</span>
          </label>
          <input
            id={ids.warranty}
            className="input"
            type="date"
            value={form.warrantyEndDate}
            onChange={(e) => set('warrantyEndDate')(e.target.value)}
            aria-describedby={ids.warrantyHint}
          />
          <div className="chips" role="group" aria-label="Set warranty length from purchase date">
            {YEAR_OPTIONS.map((years) => (
              <button
                key={years}
                type="button"
                className="chip"
                disabled={!hasPurchase}
                aria-describedby={ids.warrantyHint}
                onClick={() => set('warrantyEndDate')(addYearsToIsoDate(form.purchaseDate, years))}
              >
                {years === 1 ? '1 yr' : `${years} yrs`}
              </button>
            ))}
          </div>
          <p id={ids.warrantyHint} className="field__hint">
            {hasPurchase
              ? 'Tap a length to set the end date from the purchase date.'
              : 'Add a purchase date to set the end date by warranty length.'}
          </p>
        </div>

        {saveError ? (
          <p className="alert alert--error" role="alert">
            {saveError}
          </p>
        ) : null}

        <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
          {isEdit ? 'Save changes' : 'Save device'}
        </button>

        {isEdit && existing ? (
          <button
            type="button"
            className="btn btn--danger-quiet btn--block"
            onClick={() => setConfirmDelete(true)}
          >
            <TrashIcon />
            Delete device
          </button>
        ) : null}
      </form>

      {existing ? (
        <ConfirmDialog
          open={confirmDelete}
          title={`Delete ${existing.name}?`}
          message={`This removes ${existing.name} from HomeKind, along with all of its photos and documents. This cannot be undone.`}
          confirmLabel="Delete device"
          busy={saving}
          onConfirm={() => void onDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </Screen>
  );
}
