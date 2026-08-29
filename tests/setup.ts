/**
 * Node 26 は `--localstorage-file` 無しだと globalThis.localStorage が undefined になり、
 * jsdom 側の localStorage を覆い隠してしまう。テストではメモリ実装を差し込む。
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const storage = new MemoryStorage();

for (const target of [globalThis, window]) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    writable: true,
    value: storage,
  });
}
