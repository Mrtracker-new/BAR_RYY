# BAR Cryptographic Specifications

[Back to README](../README.md) | [Architecture](ARCHITECTURE.md) | [API Specification](API_SPECIFICATION.md) | [Development](DEVELOPMENT.md) | [Operations](OPERATIONS.md)

Formal specification of cryptographic primitives, key derivation algorithms, wire formats, and integrity verification protocols for the BAR (Burn After Reading) platform.

---

## 1. Overview & Primitives Matrix

| Domain | Operation | Primitive / Standard | Parameters |
| :--- | :--- | :--- | :--- |
| **SEAD File Containers** | Password Key Derivation | PBKDF2-HMAC-SHA256 | 600,000 iterations, 32-byte random salt, 64-byte output |
| **SEAD File Containers** | Key Splitting | `BarKey` | Bytes 0–31: Fernet key / Bytes 32–63: HMAC key |
| **SEAD File Containers** | Symmetric Encryption | Fernet (AES-128-CBC) | PKCS7 padding, 128-bit random IV per container |
| **SEAD File Containers** | Integrity Verification | HMAC-SHA256 | Canonical JSON payload, constant-time `compare_digest` |
| **Burn Chat (E2EE)** | Key Agreement | ECDH | NIST Curve P-256 (secp256r1), non-extractable private keys |
| **Burn Chat (E2EE)** | Wrap Key Derivation | HKDF-SHA256 (RFC 5869) | Info: `BAR-BurnChat-WrapKey-v1`, Salt: 32 zeros |
| **Burn Chat (E2EE)** | Session Key Wrapping | AES-GCM-256 | 12-byte random IV, 16-byte tag (60-byte wire envelope) |
| **Burn Chat (E2EE)** | Message Encryption | AES-GCM-256 | Unique 12-byte random IV per message, 16-byte tag |
| **Burn Chat (E2EE)** | Session Fingerprint | SHA-256 Truncation | `SHA-256(raw session key)[0:8]` (16 uppercase hex chars) |

---

## 2. SEAD File Sharing Cryptography

### 2.1 Password-Based Key Derivation (PBKDF2-HMAC-SHA256)
Password stretching complies with current OWASP recommendations:

* **Algorithm:** PBKDF2 with HMAC-SHA256 as the pseudorandom function (PRF).
* **Salt:** 32 bytes generated via `os.urandom(32)`.
* **Iterations:** `600,000` rounds.
* **Output Length:** 64 bytes (`raw_key`).

### 2.2 Dual-Key Architecture (`BarKey`)
To prevent cryptographic key reuse across different operations, the 64 bytes of derived material are split into two domain-separated keys:

```
+---------------------------------------------------------------+
|                      64-Byte Derived Key                      |
+-------------------------------+-------------------------------+
|       Bytes 0 to 31           |        Bytes 32 to 63         |
|   Fernet Encryption Key       |      HMAC Integrity Key       |
| (URL-safe base64 encoded)     |      (Raw 32-byte secret)     |
+-------------------------------+-------------------------------+
```

The Python class `BarKey` subclasses `bytes`, holding the Fernet key bytes while exposing the `.hmac_key` attribute. This guarantees backward compatibility with the `cryptography.fernet.Fernet` constructor while enforcing cryptographic separation.

### 2.3 Container Serialization & Canonical JSON
BAR files enforce a deterministic serialization format to ensure byte-for-byte reproducibility during integrity checks.

* **Binary Container Structure:**
  ```text
  BAR_FILE_V1\n<Base64-encoded canonical JSON>
  ```
* **Canonical JSON Rules:**
  All dictionary serialization prior to signing or verifying MUST use:
  ```python
  _CANONICAL_JSON_KWARGS = {"sort_keys": True, "separators": (',', ':')}
  ```
  Adding indentation or whitespace invalidates the signature.
* **Signing Process:**
  1. Construct the metadata and payload dictionary.
  2. Serialize dictionary to canonical JSON string.
  3. Compute HMAC-SHA256 over UTF-8 bytes using `BarKey.hmac_key`.
  4. Inject the resulting hex digest as `hmac_signature`.
  5. Base64-encode the complete JSON string and prepend `b"BAR_FILE_V1\n"`.

### 2.4 Integrity Verification & Tamper Detection
During decryption or view-count updating:
1. Extract `hmac_signature` from the deserialized payload.
2. Reconstruct the dictionary excluding `hmac_signature`.
3. Serialize to canonical JSON and compute expected HMAC digest.
4. Verify using `hmac.compare_digest(expected, actual)`. Mismatches raise `TamperDetectedException`.

---

## 3. Burn Chat End-to-End Encryption (E2EE)

### 3.1 Web Crypto API Execution
All Burn Chat cryptographic routines execute exclusively within the client browser via `window.crypto.subtle`. Private keys are marked `extractable: false`, preventing exposure to JavaScript, browser extensions, or DevTools.

### 3.2 ECDH Key Agreement & HKDF Wrap Key
1. **Key Generation:** Each participant generates an ECDH keypair on Curve P-256. Public keys are exported as Base64-encoded JSON Web Keys (JWK).
2. **Shared Secret:** The peer public key and local private key derive 256 raw bits via `SubtleCrypto.deriveBits()`.
3. **Key Derivation (HKDF-SHA256):**
   * **IKM:** 256-bit ECDH shared secret.
   * **Salt:** 32 zero bytes (`new Uint8Array(32)`).
   * **Info:** `new TextEncoder().encode('BAR-BurnChat-WrapKey-v1')`.
   * **Target:** 256-bit AES-GCM wrap key with usages `['wrapKey', 'unwrapKey']`.
4. **RFC 5869 Fallback:** For older browsers lacking native HKDF in `SubtleCrypto`, a two-stage fallback runs:
   * *Extract:* `PRK = HMAC-SHA256(salt, IKM)`
   * *Expand:* `OKM = HMAC-SHA256(PRK, info || 0x01)`
   * The first 32 bytes of `OKM` are imported as the AES-GCM wrap key.

### 3.3 Session Key Envelope Format (v2 Wire Format)
The room creator generates a random 256-bit AES-GCM session key (`extractable: true`). This key is individually encrypted for each participant using the derived wrap key:

```text
+-------------------+--------------------+--------------------+
| 12-byte Random IV | 32-byte Ciphertext | 16-byte GCM Tag    |
+-------------------+--------------------+--------------------+
| <------------------- 60 Raw Bytes ------------------------> |
| <----------------- 80 Base64 Characters ------------------> |
```

* **Legacy Handling:** Payloads of 48 bytes are processed using an all-zero 12-byte IV for backward compatibility with legacy v1 clients.

### 3.4 Message Encryption & Authentication
* **Algorithm:** AES-GCM-256.
* **Initialization Vector:** 12-byte random IV (`crypto.getRandomValues`) generated uniquely per message. IV reuse is cryptographically prohibited.
* **Authentication Tag:** 16-byte tag appended to ciphertext. Any bit modification in transit causes `SubtleCrypto.decrypt()` to throw an `OperationError`.

### 3.5 Out-of-Band Fingerprint Verification
To mitigate Man-in-the-Middle (MITM) attacks by an untrusted or compromised relay:

$$\text{Fingerprint} = \text{HexEncode}(\text{SHA-256}(\text{RawSessionKeyBytes})[0..7])$$

* **Entropy:** 64 bits (16 uppercase hexadecimal digits).
* **Usage:** Room participants compare this code out-of-band (e.g., voice, video, or verified secondary channel). Identical fingerprints guarantee that both parties share the identical session key and that public keys were not substituted by the server.
