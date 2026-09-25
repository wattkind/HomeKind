import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../src/storage';
import { base64ToBytes, bytesToBase64 } from '../src/storage/native';
import { createWebStorage } from '../src/storage/web';

const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);

describe.each([
  ['memory', createMemoryStorage],
  ['web', createWebStorage],
])('%s storage', (_name, create) => {
  it('writes, reads, deletes per file, per device and all', async () => {
    const s = create();
    await s.clear();
    await s.write('dev-a', 'att-1', 'pdf', bytes);
    await s.write('dev-a', 'att-2', 'jpg', new Uint8Array(0));
    await s.write('dev-b', 'att-3', 'jpg', bytes);
    expect(await s.read('dev-a', 'att-1', 'pdf')).toEqual(bytes);
    expect(await s.read('dev-a', 'att-2', 'jpg')).toEqual(new Uint8Array(0));

    await s.delete('dev-a', 'att-1', 'pdf');
    await s.delete('dev-a', 'att-1', 'pdf');
    await expect(s.read('dev-a', 'att-1', 'pdf')).rejects.toThrow(/not found/);

    await s.deleteAllForDevice('dev-a');
    await expect(s.read('dev-a', 'att-2', 'jpg')).rejects.toThrow();
    expect(await s.read('dev-b', 'att-3', 'jpg')).toEqual(bytes);

    await s.clear();
    await expect(s.read('dev-b', 'att-3', 'jpg')).rejects.toThrow();
  });

  it('refuses unsafe path segments', async () => {
    await expect(create().write('../x', 'a', 'jpg', bytes)).rejects.toThrow(/Unsafe/);
  });
});

describe('base64 helpers', () => {
  it('round-trip every byte value and large buffers', () => {
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    const big = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
  });
});
