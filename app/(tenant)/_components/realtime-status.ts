// Shared client-side flag so the polling fallback (NotificationPoller) can
// stand down while the websocket (RealtimeProvider) is connected. Module
// singleton within the browser bundle.
export const realtimeStatus = { connected: false };
