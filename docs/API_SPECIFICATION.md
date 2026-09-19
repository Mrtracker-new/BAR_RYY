# BAR API & WebSocket Specification

[Back to README](../README.md) | [Architecture](ARCHITECTURE.md) | [Cryptography](CRYPTOGRAPHY.md) | [Development](DEVELOPMENT.md) | [Operations](OPERATIONS.md)

Complete technical specification for the REST API and WebSocket protocols of the BAR (Burn After Reading) platform.

---

## 1. Global Conventions & Headers

* **Base URL:** `http://localhost:8000` (Local) / Production host origin.
* **Content Type:** `application/json` (or `multipart/form-data` for file uploads).
* **CSRF Protection:** All mutating HTTP requests (`POST`, `PUT`, `DELETE`) require the `X-Requested-With: XMLHttpRequest` header to trigger CORS preflights and prevent simple CSRF requests.
* **Rate Limiting:** IP-based sliding window limits are enforced across endpoints. Breaching thresholds returns HTTP `429 Too Many Requests`.

---

## 2. File Sharing REST API

### 2.1 Upload File
Accepts raw file uploads, verifies security constraints, and stages the file in temporary storage.

* **Method / Endpoint:** `POST /upload`
* **Content-Type:** `multipart/form-data`
* **Request Body:**
  * `file`: Binary file stream (max size: 100 MB).
* **Response (200 OK):**
  ```json
  {
    "file_id": "c7a840e6-3f11-477a-bcf0-6211d044238e",
    "filename": "confidential.pdf",
    "size": 1048576,
    "preview": "data:image/png;base64,..."
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Filename invalid, disallowed extension, or exceeds 100 MB.
  * `429 Too Many Requests`: Upload rate limit exceeded (10 requests/min).

---

### 2.2 Seal File Container
Encrypts a staged file, applies access limits, and returns access credentials.

* **Method / Endpoint:** `POST /seal`
* **Content-Type:** `application/json`
* **Request Body (`SealRequest`):**
  ```json
  {
    "temp_filename": "c7a840e6-3f11-477a-bcf0-6211d044238e__confidential.pdf",
    "password": "correct-horse-battery-staple",
    "storage_mode": "server",
    "expiry_minutes": 1440,
    "max_views": 1,
    "require_otp": false,
    "otp_emails": null,
    "webhook_url": "https://discord.com/api/webhooks/...",
    "view_refresh_minutes": 5,
    "auto_refresh_seconds": 0,
    "view_only": false
  }
  ```
* **Parameters:**
  * `temp_filename` (string, required): Opaque `<uuid4>__<safe_filename>` token returned by `/upload`.
  * `storage_mode` (string): `"server"` (persists encrypted container with share link) or `"client"` (returns inline base64 `.bar` data).
  * `max_views` (int): Permitted views (1 to 100).
  * `expiry_minutes` (int): Lifespan in minutes (0 to 43200; 0 = unlimited).
  * `require_otp` (bool): Require email verification before decryption.
  * `otp_emails` (list[string], optional): Authorized recipient emails (required if `require_otp: true`, max 10).
  * `view_refresh_minutes` (int): Grace window for repeated views by same client (0 to 1440).
  * `auto_refresh_seconds` (int): Forced page reload interval consuming views (0 to 300).
* **Response (200 OK - Server Mode):**
  ```json
  {
    "success": true,
    "storage_mode": "server",
    "bar_id": "4f9d8a2b-8c1e-45a2-97b0-8f9210c4d119",
    "token": "4f9d8a2b-8c1e-45a2-97b0-8f9210c4d119",
    "share_url": "/share/4f9d8a2b-8c1e-45a2-97b0-8f9210c4d119",
    "metadata": { ... },
    "message": "Container sealed successfully",
    "stats": {
      "storage_mode": "server",
      "file_size": 1048576,
      "encrypted_size": 1048700,
      "created_at": "2026-09-19T13:30:00Z"
    }
  }
  ```
* **Response (200 OK - Client Mode):**
  ```json
  {
    "success": true,
    "storage_mode": "client",
    "bar_filename": "confidential.bar",
    "bar_data": "QkFSX0ZJTEVfVjEK...",
    "metadata": { ... },
    "message": "Container sealed successfully"
  }
  ```

---

### 2.3 Container Metadata Probe
Retrieves public, unauthenticated metadata for a sealed container before decryption.

* **Method / Endpoint:** `GET /info/{bar_id}`
* **Security Design:** Intentionally public so recipients can preview file metadata before supplying passwords or consuming views. Uses `peek_bar_metadata` (header decode only; no PBKDF2 key derivation or HMAC verification).
* **Privacy Protections:** Deliberately excludes access counters (`max_views`, `current_views`) to prevent enumeration of recipient access history.
* **Response (200 OK):**
  ```json
  {
    "filename": "confidential.pdf",
    "created_at": "2026-09-19T13:30:00Z",
    "expires_at": "2026-09-20T13:30:00Z",
    "password_protected": true,
    "view_only": false
  }
  ```
* **Error Responses:**
  * `404 Not Found`: Container does not exist, has expired, or view limit was reached.
  * `422 Unprocessable Content`: Container header is corrupt or unreadable.

---

### 2.4 Download Client-Side Container
Direct download endpoint for client-side `.bar` containers.

* **Method / Endpoint:** `GET /download/{bar_id}`
* **Security Control:** Exclusively serves client-side containers. Server-side containers (present in `bar_files` database) return `404 Not Found` to force access through `/share/{token}` where access quotas and passwords are strictly enforced.
* **Response (200 OK):**
  * Binary file stream with `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="{stem}.bar"`.

---

### 2.5 Email 2FA Verification Flow

#### Step 1: Request OTP
* **Method / Endpoint:** `POST /request-otp/{token}`
* **Request Body:** `{"email": "authorized-recipient@example.com"}`
* **Response (200 OK):** `{"success": true, "message": "If the email is authorized, an OTP has been sent."}`
* **Security:** Emits an identical response regardless of whether the email is listed to prevent recipient address enumeration.

#### Step 2: Verify OTP
* **Method / Endpoint:** `POST /verify-otp/{token}`
* **Content-Type:** `application/x-www-form-urlencoded`
* **Form Field:** `otp_code="123456"`
* **Response (200 OK):** `{"success": true, "message": "OTP verified successfully. You can now access the file."}`

---

### 2.6 Decrypt & Stream File (Server-Side)
Submits password, decrements view count, and streams the decrypted file.

* **Method / Endpoint:** `POST /share/{token}`
* **Content-Type:** `application/json`
* **Request Body (`DecryptRequest`):**
  ```json
  {
    "password": "correct-horse-battery-staple"
  }
  ```
* **Response (200 OK):**
  * Decrypted file stream with appropriate `Content-Type` and `Content-Disposition`.
* **Error Responses:**
  * `401 Unauthorized`: Invalid password. Triggers progressive delay and increments brute-force counter.
  * `403 Forbidden`: Account/IP locked out (5+ failed attempts) or 2FA OTP unverified.
  * `404 Not Found`: File expired or view limit exhausted.

---

### 2.7 Decrypt Client-Side Container
Uploads an encrypted `.bar` file for server-assisted decryption.

* **Method / Endpoint:** `POST /decrypt-upload`
* **Content-Type:** `multipart/form-data`
* **Request Body:**
  * `file`: Uploaded `.bar` file.
  * `password`: Plaintext decryption password.
* **Response (200 OK):**
  * Decrypted binary file stream.

---

## 3. Burn Chat REST API

### 3.1 Create Chat Room
Provisions a new in-memory ephemeral chat room.

* **Method / Endpoint:** `POST /chat/create`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "ttl_seconds": 3600
  }
  ```
* **Constraints:** `ttl_seconds` must be between `30` and `259200` (72 hours).
* **Response (200 OK):**
  ```json
  {
    "token": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "creator_pin": "A9X2K7",
    "expires_at": "2026-09-19T14:30:00Z",
    "seconds_remaining": 3600
  }
  ```
  > Important: `creator_pin` is returned only once at creation and is never persisted to disk or database.

---

### 3.2 Query Session Metadata
Retrieves public status of an active chat room.

* **Method / Endpoint:** `GET /chat/:token/info`
* **Response (200 OK):**
  ```json
  {
    "token": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "expires_at": "2026-09-19T14:30:00Z",
    "seconds_remaining": 3412,
    "participant_count": 4,
    "locked": false,
    "created_at": "2026-09-19T13:30:00Z"
  }
  ```
* **Error Responses:**
  * `404 Not Found`: Room does not exist or has burned.

---

## 4. Burn Chat WebSocket Protocol

* **Endpoint:** `GET /chat/:token/ws` (with `Upgrade: websocket`)
* **Subprotocols:** None (JSON framing over text frames).

### 4.1 Client-to-Server Messages

#### 1. Join Room (`join`)
Sent immediately after establishing WebSocket connection.
```json
{
  "type": "join",
  "display_name": "Alice",
  "pin": "A9X2K7"
}
```
* `pin` is optional; required only to claim the room creator role.

#### 2. Announce Public Key (`pubkey`)
Broadcasts the participant's ECDH P-256 public key (Base64 JWK).
```json
{
  "type": "pubkey",
  "public_key": "eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6Ii4uLiIsInkiOiIuLi4ifQ=="
}
```

#### 3. Unicast Wrapped Session Key (`session_key`)
Creator-only. Distributes the wrapped AES session key to a specific participant.
```json
{
  "type": "session_key",
  "for_ws_id": "7b2d5a10-2e4b-4a6c-9c31-8f8101a1d999",
  "wrapped_key": "MIIB...=="
}
```

#### 4. Broadcast Message (`send`)
Transmits an encrypted chat message (or plaintext fallback).
```json
{
  "type": "send",
  "ciphertext": "k8X2...==",
  "iv": "dGVzdF9ub25jZV8xMg=="
}
```

#### 5. Creator Control Messages
* **Lock Room:** `{"type": "lock_room", "locked": true}`
* **Extend TTL:** `{"type": "extend_ttl", "extra_seconds": 900}` (max 1800s per call)
* **Kick Participant:** `{"type": "kick", "target_ws_id": "7b2d5a10..."}`

---

### 4.2 Server-to-Client Messages

#### 1. Join Confirmation (`joined`)
Sent to the joining client upon successful handshake.
```json
{
  "type": "joined",
  "participant_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "ws_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "display_name": "Alice",
  "is_creator": true,
  "seconds_remaining": 3590,
  "participant_count": 1,
  "participant_list": [
    {
      "ws_id": "9b1deb4d...",
      "display_name": "Alice",
      "role": "creator",
      "is_creator": true,
      "public_key": null
    }
  ],
  "locked": false
}
```

#### 2. Relay Message (`message`)
Broadcast to room participants.
```json
{
  "type": "message",
  "id": "5f8b9d31-4c2a-4f51-b0e1-7d9210c4d119",
  "sender_id": "9b1deb4d...",
  "sender_name": "Alice",
  "sent_at": "2026-09-19T13:35:00Z",
  "is_creator": true,
  "ciphertext": "k8X2...==",
  "iv": "dGVzdF9ub25jZV8xMg=="
}
```

#### 3. Room Countdown & Burn
* **Countdown Tick:** `{"type": "countdown", "seconds_remaining": 45}` (every 10s when >60s, every 1s when <=60s).
* **Room Destroyed:** `{"type": "destroyed"}` (emitted before connections are closed).

---

### 4.3 WebSocket Close Codes
* `1000 Normal Closure`: Room TTL expired cleanly or user disconnected voluntarily.
* `1001 Going Away`: Client exceeded 3.0s broadcast delivery timeout (slowloris mitigation).
* `4001 Kicked`: Participant removed by room creator.
* `4003 Unauthorized`: Creator PIN invalid or room is locked.
