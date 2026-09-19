# BAR Operations & Diagnostic Runbooks

[Back to README](../README.md) | [Architecture](ARCHITECTURE.md) | [Cryptography](CRYPTOGRAPHY.md) | [API Specification](API_SPECIFICATION.md) | [Development](DEVELOPMENT.md)

Operational runbooks, failure mode diagnostics, network troubleshooting, and log signatures for the BAR (Burn After Reading) platform.

---

## 1. System Diagnostics Matrix

| Symptom / Error | Probable Root Cause | Diagnostic Verification | Remediation Procedure |
| :--- | :--- | :--- | :--- |
| `HTTP 401 Unauthorized` on file decryption | Incorrect password submitted | Inspect access logs for repeated failed POST requests to `/share/:token`. | Re-verify password with the container creator. Note: Successive failures trigger exponential delay penalties. |
| `HTTP 403 Forbidden` ("Too many failed attempts") | Progressive brute-force lockout triggered (5+ failed attempts) | Verify client IP in `backend/core/security.py` `password_attempts` table. | Client must wait 60 minutes for the sliding lockout window to expire. Lockouts cannot be bypassed by IP rotation behind trusted proxies. |
| `HTTP 404 Not Found` on `/share/:token` | Container has expired via TTL or view quota exhaustion | Query `bar_files.db`: check `expires_at` timestamp and `current_views` vs `max_views`. | Expected system behavior. Expired or exhausted files are permanently unlinked and cannot be recovered. |
| `TamperDetectedException` ("BAR file integrity check failed") | Ciphertext or metadata altered, or HMAC signature mismatch | Verify that canonical JSON ordering was preserved and key derivation completed without corruption. | The container has been tampered with or corrupted in transit. The file cannot and will not be decrypted. |
| `WebSocket Close Code 1001` | Broadcast timeout: participant connection failed to accept data within 3.0s | Check backend logs for `"Broadcast timeout or connection error"`. | Client device experienced high network latency or TCP buffer exhaustion. Refresh connection from an active network. |
| `WebSocket Close Code 4001` | Participant removed by room creator | Verify room event logs for `kick` event initiated by the creator. | Normal operational behavior. Kicked participants are prohibited from rejoining the room. |
| `WebSocket Close Code 4003` | Invalid creator PIN or room locked | Verify PIN submission against `_ChatSession.creator_pin` in memory. | Verify creator PIN. If room is locked, only the authenticated creator may connect. |

---

## 2. Network & Reverse Proxy Diagnostics

### 2.1 IP Attribution & Proxy Header Validation
BAR utilizes right-to-left `X-Forwarded-For` traversal to prevent IP spoofing attacks. For this mechanism to function:

1. **Verify Ingress CIDR Match:** The immediate upstream reverse proxy must have its IP range included in `TRUSTED_PROXY_CIDRS`.
   * Check current configuration in `.env`:
     ```env
     TRUSTED_PROXY_CIDRS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
     ```
2. **Symptoms of Misconfigured CIDRs:**
   * Audit logs and webhooks record `"Unknown"` or internal proxy IPs rather than real client IPs.
   * Legitimate users encounter shared brute-force lockouts due to proxy IP pooling.
3. **Remediation:** Add the egress IP ranges of your CDN or load balancer (e.g., Cloudflare IP list, Render egress ranges) to `TRUSTED_PROXY_CIDRS`. In local development without proxies, set `TRUSTED_PROXY_CIDRS=none`.

---

## 3. Port & Process Management

### 3.1 Port Already in Use (Port 8000 or 5173)

#### Windows Diagnostics & Resolution
```cmd
# Identify process listening on port 8000
netstat -ano | findstr :8000

# Terminate offending process by PID
taskkill /PID <PID> /F
```

#### POSIX / Linux / macOS Diagnostics & Resolution
```bash
# Identify process listening on port 8000
lsof -i :8000

# Terminate process
kill -9 <PID>
```

---

## 4. Ephemeral Cleanup & Memory Diagnostics

### 4.1 Automated File Cleanup Verification
The background cleanup loop executes every 60 seconds to purge expired containers:

* **Log Signature:**
  ```text
  INFO:services.cleanup:Cleaned up N expired files
  ```
* **Database Verification:**
  Run the following SQLite query to verify no expired files remain orphaned:
  ```sql
  SELECT id, filename, expires_at, current_views, max_views 
  FROM files 
  WHERE expires_at < datetime('now') OR current_views >= max_views;
  ```

### 4.2 Burn Chat Session Memory Reclaim
Burn Chat sessions reside entirely in process memory:

* When a session TTL expires, the countdown background task triggers `_destroy_session()`.
* **Safety-Net Audit:** A secondary safety-net loop invokes `cleanup_expired_sessions()` periodically to terminate orphaned rooms whose countdown loops may have stalled.
* Memory is freed immediately via Python garbage collection once all references in `_SESSIONS` are dereferenced.

---

## 5. Webhook Integration Diagnostics

### 5.1 Failure Conditions & Constraints
* **HTTPS Enforcement:** Webhook URLs must use `https://`. Insecure `http://` targets are rejected by the validator to prevent token leakage.
* **Rate Limits:** A maximum of 10 webhook delivery attempts are permitted per sealed file container to prevent notification flooding.
* **Timeout:** Webhook HTTP requests timeout after 5.0 seconds. Failed deliveries do not block or revert file decryption operations.
