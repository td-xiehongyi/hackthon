/*
 * Content script for the local app.  It is intentionally a very small bridge:
 * the privileged extension context receives a validated payload, then this
 * script posts it to the page so React can opt into the import flow.
 */
(() => {
  'use strict';
  const APP_ORIGIN = window.location.origin;
  const SOURCE = 'csu-browser-extension';
  // Keep this public message name in sync with src/features/teaching/
  // csuExtensionBridge.ts.  The service worker uses a different internal
  // name so page scripts cannot accidentally impersonate the worker channel.
  const BRIDGE_TYPE = 'CSU_SCHEDULE_CAPTURE';
  const WORKER_TYPE = 'CSU_SCHEDULE_CAPTURED';

  const postPayload = (message) => {
    if (!message || message.type !== WORKER_TYPE || !message.payload || message.payload.source !== SOURCE) return;
    window.postMessage({
      source: SOURCE,
      type: BRIDGE_TYPE,
      payload: {
        ...message.payload,
        pageUrl: message.payload.pageUrl || (message.payload.page
          ? `https://${message.payload.page.host || ''}${message.payload.page.path || ''}`
          : undefined),
        pageTitle: message.payload.pageTitle || message.payload.page?.title,
      },
      replay: Boolean(message.replay),
    }, APP_ORIGIN);
  };

  chrome.runtime.onMessage.addListener((message) => {
    // A replay can arrive immediately after document_idle, before React has
    // mounted its window message listener. Give the app a short mount window;
    // fresh captures are delivered immediately because the app tab is already
    // open and interactive in that flow.
    if (message && message.replay) window.setTimeout(() => postPayload(message), 350);
    else postPayload(message);
  });

  // Ask the service worker to replay the last user-triggered capture. This
  // makes opening/reloading the app after capturing deterministic, while the
  // worker keeps only the latest normalised schedule in extension storage.
  chrome.runtime.sendMessage({ type: 'CSU_APP_READY' }, () => {
    // Reading chrome.runtime.lastError prevents an absent service worker from
    // producing an uncaught console warning in development builds.
    void chrome.runtime.lastError;
  });
})();
