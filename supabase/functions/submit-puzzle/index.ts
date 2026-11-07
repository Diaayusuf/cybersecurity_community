import { createSubmitPuzzleHandler } from './handler.mjs';

Deno.serve(createSubmitPuzzleHandler({
  env: Deno.env,
  fetchImpl: fetch.bind(globalThis),
  cryptoImpl: globalThis.crypto,
}));