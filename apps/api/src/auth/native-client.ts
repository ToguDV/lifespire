/**
 * Native-token grant gate.
 *
 * Browsers can spoof arbitrary headers, so a header alone must never expose
 * the long-lived refresh token to page JavaScript. Browsers do send `Origin`
 * on credentialed POSTs and Fetch Metadata headers, and JavaScript cannot set
 * either one (they are forbidden headers). Requiring their absence, plus the
 * explicit native-client header, keeps the HttpOnly cookie contract for web
 * while letting the Android/iOS app receive a token for secure storage.
 *
 * `desktop` is the Electron shell: its main process calls the API from a
 * dedicated in-memory session that strips Fetch Metadata before sending, and
 * it keeps the token in the OS keychain instead of the renderer.
 */
export const NATIVE_CLIENT_HEADER = 'x-client-platform';
export const NATIVE_CLIENT_PLATFORMS = ['android', 'ios', 'desktop'] as const;

export interface NativeClientRequest {
  headers: Record<string, unknown>;
}

export function isNativeClient(req: NativeClientRequest): boolean {
  const platform = req.headers[NATIVE_CLIENT_HEADER];
  if (typeof platform !== 'string') return false;
  if (!(NATIVE_CLIENT_PLATFORMS as readonly string[]).includes(platform)) return false;
  if (req.headers.origin) return false;
  if (req.headers['sec-fetch-site']) return false;
  return true;
}
