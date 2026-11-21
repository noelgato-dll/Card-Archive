/* Card Archive encrypted release activation — v0.4.16 Stable.
 *
 * Replaces the earlier flag-based lock. There is no "unlocked" boolean
 * anywhere in this file or in storage. The password is used to derive an
 * AES-GCM key; that key is what decrypts script.enc.json into the real,
 * running application. A wrong password makes decryption throw (AES-GCM
 * authenticates its ciphertext) — there is nothing to forge in DevTools,
 * because there is no separate "did they enter it correctly" flag to set.
 *
 * What this still does NOT do: stop someone from reading the decrypted
 * script.js in DevTools once it's running, or from patching this file's
 * own logic in a debugger. No client-only scheme can do that. This raises
 * the bar from "one console line" to "you have to actually break the
 * encryption or intercept it while running," which is the realistic
 * ceiling for a purely static, offline-first app with no server.
 */
'use strict';

const CA_LOCK_RELEASE = '0.4.16';
const CA_UNLOCK_SESSION_KEY = 'card-archive-permanent-key-v2-' + CA_LOCK_RELEASE; // IndexedDB-held key handle, NOT a boolean
const CA_ENC_MANIFEST_URL = 'script.enc.json?v=0416-stable-encrypted';

function caFail(root, message) {
  const err = document.getElementById('caActivationError');
  if (err) { err.textContent = message; return; }
  if (root) root.innerHTML = `<div class="caActivationDialog"><p role="alert">${message}</p></div>`;
}

async function caDeriveKey(password, saltB64, iterations, usage) {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable; stored as a CryptoKey in IndexedDB
    [usage]
  );
}

async function caDecryptScript(key, manifest) {
  const iv = Uint8Array.from(atob(manifest.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(manifest.ciphertext), c => c.charCodeAt(0));
  // Throws (OperationError) on a wrong key. This IS the check — not an if-statement.
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

function caRunDecryptedApp(code) {
  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const script = document.createElement('script');
  script.src = blobUrl;
  script.onload = () => URL.revokeObjectURL(blobUrl);
  script.onerror = () => console.error('Decrypted application script failed to load.');
  document.body.appendChild(script);
}

/* --- Optional convenience: remember the derived key on THIS device only, so a
 * returning user doesn't retype the password every visit. This is explicitly
 * NOT a security boundary — it's the same trade-off the old "Remove Lock"
 * switch made, just done honestly: the key is held in IndexedDB (not a
 * plaintext flag in localStorage), and clearing it requires the same
 * "Remove convenience" action in Settings, which re-derives nothing and
 * simply forgets the stored key. Anyone who can read IndexedDB in DevTools
 * can already read the running app anyway, so this adds no new exposure. */
let caSessionKey = null;
let caPermanentUnlock = false;

// A persisted, authenticated AES key is the ONLY durable unlock credential.
// The previous DEV auto-remembered key is deliberately not reused.
window.caActivationIsPermanent = () => caPermanentUnlock;
window.caRemoveActivationLock = async () => {
  if (caPermanentUnlock) return true;
  if (!caSessionKey) throw new Error('Activation key unavailable. Please unlock this release again.');
  await caKeyStore.save(caSessionKey);
  caPermanentUnlock = true;
  return true;
};

const caKeyStore = (() => {
  const dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open('card-archive-activation', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return {
    async save(key) {
      const db = await dbp;
      return new Promise((res, rej) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put(key, CA_UNLOCK_SESSION_KEY);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    },
    async load() {
      const db = await dbp;
      return new Promise((res, rej) => {
        const tx = db.transaction('keys', 'readonly');
        const req = tx.objectStore('keys').get(CA_UNLOCK_SESSION_KEY);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
    },
    async clear() {
      const db = await dbp;
      return new Promise((res, rej) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').delete(CA_UNLOCK_SESSION_KEY);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    },
  };
})();

async function caTryStoredKey(manifest) {
  const raw = await caKeyStore.load().catch(() => null);
  if (!raw) return false;
  try {
    const key = raw;
    const code = await caDecryptScript(key, manifest);
    caPermanentUnlock = true;
    caRunDecryptedApp(code);
    return true;
  } catch {
    await caKeyStore.clear().catch(() => {}); // stale/corrupted — don't keep retrying with it
    return false;
  }
}

function caLockScreen(manifest) {
  const root = document.getElementById('caActivationRoot');
  if (!root) return;
  root.innerHTML = `<div class="caActivationDialog" role="dialog" aria-modal="true" aria-labelledby="caActivationHeading"><div class="caActivationBrand">CARD ARCHIVE / V${CA_LOCK_RELEASE}<span class="caActivationAuthor">noelgato-dll</span></div><h2 id="caActivationHeading">Activation Required</h2><p>Enter the password for this stable release.</p><form id="caActivationForm"><input aria-label="Release password" id="caActivationPassword" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="64" /><p id="caActivationError" role="alert" aria-live="polite"></p><button type="submit">Confirm</button></form></div>`;
  const input = document.getElementById('caActivationPassword');
  input.focus();
  document.getElementById('caActivationForm').onsubmit = async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const err = document.getElementById('caActivationError');
    err.textContent = '';
    try {
      const key = await caDeriveKey(input.value, manifest.salt, manifest.iterations, 'decrypt');
      const code = await caDecryptScript(key, manifest); // throws on wrong password
      caSessionKey = key; // session only until Remove Lock is explicitly toggled
      caRunDecryptedApp(code);
      root.remove();
    } catch (_) {
      caFail(root, 'Incorrect activation password.');
      input.value = '';
      input.focus();
    } finally {
      btn.disabled = false;
    }
  };
}

(async function caBoot() {
  let manifest;
  if (location.protocol === 'file:') {
    caFail(document.getElementById('caActivationRoot'), 'Local file mode is not supported. Open this release through http://localhost or HTTPS.');
    return;
  }
  try {
    const response = await fetch(CA_ENC_MANIFEST_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Encrypted package HTTP ' + response.status);
    manifest = await response.json();
    if (!manifest || !manifest.salt || !manifest.iv || !manifest.ciphertext || !Number.isInteger(manifest.iterations)) {
      throw new Error('Invalid encrypted release package');
    }
  } catch (e) {
    console.error('Card Archive encrypted package failed to load:', e);
    caFail(document.getElementById('caActivationRoot'), navigator.onLine === false
      ? 'Encrypted release package is unavailable offline. Connect once to finish installing this release.'
      : 'Could not load the encrypted release package. Check the deployed script.enc.json file and reload.');
    return;
  }
  const alreadyRunning = await caTryStoredKey(manifest);
  if (!alreadyRunning) caLockScreen(manifest);
})();
