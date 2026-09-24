import { browserApi } from './browser';
export const api = window.melodica || browserApi;
export async function unwrap(promise) {
  const result = await promise;
  if (!result.ok) throw Error(result.error);
  return result.value;
}
