// Push services used by browsers to deliver Web Push messages. The cron job
// POSTs to every stored endpoint, so accepting any URL would let a user make
// the server call arbitrary (including internal) addresses.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',            // Chrome, Edge (Chromium), Opera…
  'push.services.mozilla.com',     // Firefox (updates.push.services.mozilla.com)
  'push.apple.com',                // Safari (web.push.apple.com)
  'notify.windows.com',            // Legacy Edge / Windows (WNS)
];

/** True for an https URL on a known browser push service (exact host or subdomain). */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return PUSH_SERVICE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
}
