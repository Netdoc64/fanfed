/** In-Memory-Ersatz für das R2-Binding — nur für Tests. */
export interface FakeR2 extends R2Bucket {
  /** Rohbytes, wie sie in R2 liegen. */
  inhalt: Map<string, Uint8Array>;
}

export function createFakeR2(): FakeR2 {
  const inhalt = new Map<string, Uint8Array>();
  const bucket = {
    inhalt,
    async put(key: string, value: ArrayBuffer | ArrayBufferView | string) {
      inhalt.set(
        key,
        typeof value === 'string'
          ? new TextEncoder().encode(value)
          : value instanceof ArrayBuffer
            ? new Uint8Array(value.slice(0))
            : new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)),
      );
      return null;
    },
    async get(key: string) {
      const bytes = inhalt.get(key);
      if (!bytes) return null;
      return { arrayBuffer: async () => bytes.slice().buffer, size: bytes.length };
    },
    async delete(key: string) {
      inhalt.delete(key);
    },
  };
  return bucket as unknown as FakeR2;
}
