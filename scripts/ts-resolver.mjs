/**
 * Node で `src/` の TypeScript をそのまま実行するための解決フック。
 *
 * `src/` 内の import は Vite の解決に合わせて拡張子を省略しているが、
 * Node の ESM は拡張子を補完しない。そのため、解決に失敗した相対 import に
 * `.ts` を付けて再試行する。
 *
 * 使い方: node --import ./scripts/ts-resolver.mjs scripts/dump-catalog.ts
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
