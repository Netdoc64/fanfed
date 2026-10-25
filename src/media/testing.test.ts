import { expect, it } from 'vitest';
import { createFakeR2 } from './testing';

it('put/get/delete verhalten sich wie R2', async () => {
  const r2 = createFakeR2();
  await r2.put('k', new Uint8Array([1, 2, 3]));
  expect(new Uint8Array(await (await r2.get('k'))!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  await r2.delete('k');
  expect(await r2.get('k')).toBeNull();
});
