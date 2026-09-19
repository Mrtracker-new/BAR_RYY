/**
 * burnChatE2E.js — BurnChat end-to-end encryption utilities.
 *
 * Pure Web Crypto API — zero runtime dependencies, zero bundle overhead.
 * Every exported function is async and returns a native Promise.
 *
 * Cryptographic stack
 * ───────────────────
 *   Key agreement  : ECDH P-256
 *   Wrap key       : HKDF-SHA256 (info: 'BAR-BurnChat-WrapKey-v1') derived from ECDH shared secret
 *   Key wrapping   : AES-GCM-256 with unique 12-byte random IV prepended to wrapped key
 *   Session key    : Random AES-GCM-256 (creator-generated, distributed to peers)
 *   Message cipher : AES-GCM-256, unique 12-byte random IV per message
 *   Fingerprint    : SHA-256(raw session key bytes)[0..7] → 16 uppercase hex chars
 *
 * Security properties
 * ───────────────────
 *   • Private ECDH keys: extractable:false — the browser's WebCrypto subsystem
 *     holds the raw bytes; JS, DevTools, and browser extensions cannot read them.
 *     Public keys are automatically marked extractable:true (W3C spec §generateKey
 *     step 12.2) so exportPublicKey() works without relaxing private-key security.
 *   • AES-GCM auth tag: verified on every decryptMessage() call by the browser.
 *     A tampered ciphertext immediately throws — the caller handles this and shows
 *     an error bubble rather than silently delivering garbage.
 *   • IV reuse on messages & wrapping: impossible — crypto.getRandomValues() supplies 96 bits
 *     of entropy for every individual encrypt and key wrapping call.
 *   • HKDF domain separation: versioned info string prevents cross-protocol attacks.
 */

// ---------------------------------------------------------------------------
// Lazy accessor — defers window.crypto.subtle access to call time.
// This prevents build-time / SSR errors if the module is bundled in a context
// that doesn't yet have a window object.
// ---------------------------------------------------------------------------

/** @returns {SubtleCrypto} */
const _subtle = () => window.crypto.subtle;

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Encode an ArrayBuffer to standard (RFC 4648 §4) base64.
 * Uses a loop rather than spread-into-String.fromCharCode to avoid the
 * call-stack argument limit on large buffers (e.g. 4 KB ciphertexts).
 *
 * @param   {ArrayBuffer} buf
 * @returns {string}
 */
function _toB64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a standard base64 string to an ArrayBuffer.
 *
 * @param   {string} b64
 * @returns {ArrayBuffer}
 */
function _fromB64(b64) {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer;
}

/**
 * All-zero 12-byte IV used as fallback for legacy key unwrapping.
 */
const _WRAP_IV = new Uint8Array(12); // 96 zero bits

// ---------------------------------------------------------------------------
// Public API — 11 exported functions
// ---------------------------------------------------------------------------

/**
 * Return true if the Web Crypto API is available in this context.
 *
 * crypto.subtle is only exposed in secure contexts (HTTPS or localhost).
 * Callers should check this first and surface a degradation banner if false.
 *
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.crypto !== 'undefined' &&
      typeof window.crypto.subtle !== 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * Generate an ECDH P-256 key pair.
 *
 * The private key is generated with extractable:false — the browser will
 * refuse to export its raw bytes via exportKey(), protecting it from JS,
 * extensions, and DevTools inspection.
 *
 * The public key is automatically marked extractable:true by the browser
 * (W3C Web Crypto spec §generateKey step 12.2), enabling exportPublicKey().
 *
 * @returns {Promise<CryptoKeyPair>}  { privateKey, publicKey }
 */
export async function generateKeyPair() {
  return _subtle().generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,          // extractable — private key never leaves the browser
    ['deriveBits'], // sole usage: ECDH shared-secret derivation
  );
}

/**
 * Export an ECDH public key to a base64-encoded JWK string.
 *
 * JWK (JSON Web Key) is chosen as the interchange format because it is
 * self-describing (encodes curve, key type, and coordinates in one object)
 * and natively supported by the Web Crypto importKey() API.
 *
 * Wire format: base64( JSON.stringify(JWK) )
 *
 * @param   {CryptoKey} publicKey
 * @returns {Promise<string>}  base64-encoded JWK
 */
export async function exportPublicKey(publicKey) {
  const jwk = await _subtle().exportKey('jwk', publicKey);
  return btoa(JSON.stringify(jwk));
}

/**
 * Import an ECDH public key from its base64-encoded JWK representation.
 *
 * @param   {string}    b64  Output of exportPublicKey()
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(b64) {
  const jwk = JSON.parse(atob(b64));
  return _subtle().importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,  // public keys are safely exportable
    [],    // no direct key usages — provided only in deriveBits algorithm params
  );
}

/**
 * Generate a random AES-GCM-256 session key.
 *
 * extractable:true is required for:
 *   1. wrapKey()          — the browser exports raw bytes before encrypting them.
 *   2. sessionFingerprint() — raw export is the fingerprint input.
 *
 * Usages are restricted to encrypt/decrypt; the session key never acts as a
 * wrapping key (that role belongs to the ECDH-derived wrap key).
 *
 * @returns {Promise<CryptoKey>}
 */
export async function generateSessionKey() {
  return _subtle().generateKey(
    { name: 'AES-GCM', length: 256 },
    true,                    // extractable — required for wrap and fingerprint
    ['encrypt', 'decrypt'],  // message encryption only
  );
}

/**
 * Derive a per-pair AES-GCM-256 wrap key from an ECDH shared secret using HKDF-SHA256.
 *
 * Algorithm:
 *   1. ECDH P-256 deriveBits(myPrivateKey, theirPublicKey) → 256 raw bits.
 *   2. HKDF-SHA256(ikm: rawBits, salt: 32 zeros, info: 'BAR-BurnChat-WrapKey-v1') → 256-bit AES-GCM key.
 *
 * Salt:
 *   HKDF-Extract with zero salt is equivalent to HMAC-SHA256(0^32, shared_secret).
 *   This is RFC 5869 §3.1 compliant: the ECDH P-256 shared secret has full 256-bit
 *   entropy, so additional salt randomness is not required.
 *
 * Portability:
 *   Uses native Web Crypto HKDF if supported (Chrome 113+, Firefox 122+, Safari 17.4+),
 *   and seamlessly falls back to RFC 5869 HMAC-SHA256 for older browsers/WebViews.
 *
 * @param   {CryptoKey} myPrivateKey   Own ECDH private key
 * @param   {CryptoKey} theirPublicKey Peer's ECDH public key
 * @returns {Promise<CryptoKey>}       AES-GCM-256 key with wrapKey/unwrapKey usages
 */
export async function deriveWrapKey(myPrivateKey, theirPublicKey) {
  const rawBits = await _subtle().deriveBits(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    256, // 32 bytes — full P-256 shared secret
  );

  const salt = new Uint8Array(32); // 32 zero bytes — RFC 5869 §3.1
  const info = new TextEncoder().encode('BAR-BurnChat-WrapKey-v1');

  // Attempt native Web Crypto HKDF
  try {
    const hkdfKey = await _subtle().importKey(
      'raw',
      rawBits,
      { name: 'HKDF' },
      false,
      ['deriveKey'],
    );
    return await _subtle().deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info,
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  } catch {
    // Fallback: Manual HKDF (RFC 5869) via HMAC-SHA256 for older browser engines
    // Step 1: Extract — PRK = HMAC-SHA256(salt, IKM)
    const saltKey = await _subtle().importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const prk = await _subtle().sign('HMAC', saltKey, rawBits);

    // Step 2: Expand — OKM = HMAC-SHA256(PRK, info || 0x01)
    const prkKey = await _subtle().importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const input = new Uint8Array(info.length + 1);
    input.set(info, 0);
    input[info.length] = 0x01;
    const okm = await _subtle().sign('HMAC', prkKey, input);

    return await _subtle().importKey(
      'raw',
      okm.slice(0, 32),
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  }
}

/**
 * Wrap (encrypt) the session key for transmission to one peer.
 *
 * Uses AES-GCM with a fresh 12-byte random IV.
 * Wire format: base64( 12-byte IV + AES-GCM-encrypt(wrapKey, rawSessionKeyBytes, iv) )
 * Output size: 60 bytes raw → 80 base64 chars (12-byte IV + 32-byte key + 16-byte auth tag).
 *
 * @param   {CryptoKey} sessionKey  AES-GCM session key (extractable:true)
 * @param   {CryptoKey} wrapKey     Output of deriveWrapKey()
 * @returns {Promise<string>}       base64-encoded opaque blob
 */
export async function wrapSessionKey(sessionKey, wrapKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit random IV
  const wrapped = await _subtle().wrapKey(
    'raw',                               // export format for the session key bytes
    sessionKey,
    wrapKey,
    { name: 'AES-GCM', iv },
  );

  const combined = new Uint8Array(iv.byteLength + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), iv.byteLength);
  return _toB64(combined.buffer);
}

/**
 * Unwrap (decrypt + import) a session key received from the creator.
 *
 * Extracts the 12-byte random IV prepended during wrapSessionKey() (or falls back
 * to zero IV for legacy 48-byte payloads). Throws an Error or DOMException if the wrapped blob
 * has an unexpected length or if AES-GCM authentication fails.
 *
 * @param   {string}    b64       Output of wrapSessionKey()
 * @param   {CryptoKey} wrapKey   Output of deriveWrapKey() using creator's pubkey
 * @returns {Promise<CryptoKey>}  Recovered AES-GCM-256 session key
 * @throws  {Error|DOMException}  On length mismatch or authentication failure
 */
export async function unwrapSessionKey(b64, wrapKey) {
  const raw = new Uint8Array(_fromB64(b64));
  let iv;
  let ciphertext;

  if (raw.byteLength === 60) {
    // Modern v2: 12-byte random IV + 32-byte key + 16-byte GCM tag
    iv = raw.slice(0, 12);
    ciphertext = raw.slice(12).buffer;
  } else if (raw.byteLength === 48) {
    // Legacy: 32-byte key + 16-byte GCM tag, zero IV
    iv = _WRAP_IV;
    ciphertext = raw.buffer;
  } else {
    throw new Error(`Unexpected wrapped key length: ${raw.byteLength}`);
  }

  return _subtle().unwrapKey(
    'raw',
    ciphertext,
    wrapKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true, // extractable — needed for sessionFingerprint
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a UTF-8 plaintext message with the shared session key.
 *
 * A fresh 12-byte IV is generated via crypto.getRandomValues() for every
 * call.  AES-GCM is catastrophically insecure under IV reuse with the same
 * key — this step is NEVER skipped or made optional.
 *
 * @param   {string}    text        UTF-8 plaintext to encrypt
 * @param   {CryptoKey} sessionKey  Shared AES-GCM-256 session key
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 *          Both values are standard base64 strings safe for JSON transport.
 */
export async function encryptMessage(text, sessionKey) {
  const plaintext = new TextEncoder().encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit random IV
  const ciphertext = await _subtle().encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    plaintext,
  );
  return {
    ciphertext: _toB64(ciphertext),
    iv: _toB64(iv),
  };
}

/**
 * Decrypt and authenticate a ciphertext received from another participant.
 *
 * The browser verifies the AES-GCM authentication tag before returning any
 * bytes.  If the ciphertext, IV, or tag has been modified in transit, this
 * function rejects — callers must catch this and render an error indicator
 * rather than crashing the whole session.
 *
 * @param   {string}    ciphertextB64  base64 ciphertext from encryptMessage()
 * @param   {string}    ivB64          base64 IV from encryptMessage()
 * @param   {CryptoKey} sessionKey     Shared AES-GCM-256 session key
 * @returns {Promise<string>}          Decrypted UTF-8 plaintext
 * @throws  {DOMException}             "OperationError" on authentication failure
 */
export async function decryptMessage(ciphertextB64, ivB64, sessionKey) {
  const plaintext = await _subtle().decrypt(
    { name: 'AES-GCM', iv: _fromB64(ivB64) },
    sessionKey,
    _fromB64(ciphertextB64),
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Compute a short fingerprint of the shared session key.
 *
 * Every participant who holds the correct session key (creator-generated,
 * wrapped and unwrapped successfully) will compute the same fingerprint.
 * Participants can compare this value out-of-band (e.g. verbally) to verify
 * the server did not substitute public keys during the key exchange.
 *
 * Algorithm:  SHA-256(raw AES-GCM key bytes)[0..7]  →  16 uppercase hex chars
 * Example:    "A3F7C2B81D9E045A"
 *
 * Using raw key bytes (not the JWK) guarantees both creator and participant
 * hash the same 32-byte value regardless of JWK field ordering differences.
 *
 * @param   {CryptoKey} sessionKey  Must be extractable:true
 * @returns {Promise<string>}       16 uppercase hex characters
 */
export async function sessionFingerprint(sessionKey) {
  const rawKey = await _subtle().exportKey('raw', sessionKey);
  const hash = await _subtle().digest('SHA-256', rawKey);
  const bytes = new Uint8Array(hash);
  // Slice first 8 bytes → 16 hex digits (64 bits). 2^64 distinct values —
  // virtually eliminates any chance of key collision or substitution attacks.
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
