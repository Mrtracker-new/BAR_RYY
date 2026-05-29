/**
 * Vercel Serverless Function — Burn Chat OG Preview Page
 *
 * GET /api/og/chat/[token]
 *
 * Purpose
 * -------
 * WhatsApp, Telegram, Twitter/X, Discord, Slack, iMessage and every other
 * social platform use bots that fetch the raw HTML of a shared URL and parse
 * <meta property="og:*"> tags to build a link-preview card.  Because the
 * frontend is a React SPA, every /chat/:token route returns the same
 * index.html — carrying only the site-wide "file sharing" OG defaults.
 *
 * This function returns a minimal HTML page with Burn Chat-specific OG /
 * Twitter meta tags so the preview card always says "Join Burn Chat" instead
 * of "Self-Destructing Files".
 *
 * Browser flow
 * ------------
 * Real browsers follow <meta http-equiv="refresh" content="0;url=/chat/:token">
 * and land on the SPA instantly — they never see this page.
 * Social bots stop at the meta tags and ignore the refresh.
 *
 * Reliability strategy
 * --------------------
 * The function attempts to fetch live session data (seconds_remaining,
 * participant_count) from the FastAPI backend with a 2 500 ms hard timeout.
 * If the backend is sleeping (Render free tier cold-start ~50 s) or returns
 * an error, the function falls back to a high-quality generic Burn Chat card
 * that is still far more useful than the global file-sharing defaults.
 *
 * This makes the preview independent of backend availability.
 *
 * Routing
 * -------
 * vercel.json rewrite: /og/chat/:token → /api/og/chat/:token
 * This stays within the same Vercel deployment — no external host needed.
 * BurnChatPage.jsx and BurnChatCreate.jsx generate /og/chat/:token share URLs.
 */

const OG_SITE        = 'https://bar-rnr.vercel.app';
const OG_CHAT_IMAGE  = `${OG_SITE}/og-chat.png`;
const OG_IMAGE_ALT   = 'Burn Chat — End-to-End Encrypted Ephemeral Chat | BAR Web';
const OG_SITE_NAME   = 'BAR by Rolan';

// Backend base URL — reads from the Vercel environment variable set in the
// project dashboard.  Falls back to the known Render service URL.
// Update VITE_BACKEND_URL in Vercel → Project Settings → Environment Variables.
const BACKEND_BASE   = process.env.VITE_BACKEND_URL || 'https://bar-rnr-api.onrender.com';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Escape characters unsafe inside HTML attribute values. */
function escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Return true only for well-formed UUID v4 strings. */
function isUUIDv4(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    String(token)
  );
}

/**
 * Attempt to fetch live session metadata from the FastAPI backend.
 *
 * Returns the parsed JSON body on success, null on any error or timeout.
 * The 2 500 ms AbortController timeout prevents the function from blocking
 * for the full Render cold-start (~50 s) and degrading user experience.
 */
async function fetchSessionInfo(token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`${BACKEND_BASE}/chat/${token}/info`, {
      signal: controller.signal,
      headers: {
        // Identify the request so backend logs can distinguish OG bot traffic.
        'User-Agent': 'BAR-OG-Crawler/1.0',
        'Accept':     'application/json',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/** Build the complete OG HTML document. */
function buildHTML({ title, description, canonicalUrl }) {
  const t   = escape(title);
  const d   = escape(description);
  const url = escape(canonicalUrl);
  const img = escape(OG_CHAT_IMAGE);
  const alt = escape(OG_IMAGE_ALT);
  const sn  = escape(OG_SITE_NAME);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t}</title>

  <!-- Crawlers: ephemeral session links must not be indexed -->
  <meta name="robots" content="noindex,nofollow">

  <!-- Canonical -->
  <link rel="canonical" href="${url}">

  <!-- Open Graph — WhatsApp, Telegram, Facebook, iMessage, Discord … -->
  <meta property="og:type"         content="website">
  <meta property="og:url"          content="${url}">
  <meta property="og:site_name"    content="${sn}">
  <meta property="og:title"        content="${t}">
  <meta property="og:description"  content="${d}">
  <meta property="og:image"        content="${img}">
  <meta property="og:image:secure_url" content="${img}">
  <meta property="og:image:alt"    content="${alt}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type"   content="image/png">

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:url"         content="${url}">
  <meta name="twitter:title"       content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image"       content="${img}">
  <meta name="twitter:image:alt"   content="${alt}">

  <!-- Instant redirect for real browsers.
       Crawlers stop at the meta tags above and never follow this. -->
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>
    Redirecting to Burn Chat&hellip;
    <a href="${url}">Click here if not redirected.</a>
  </p>
</body>
</html>`;
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { token } = req.query;

  // ── Invalid / missing token ──────────────────────────────────────────────
  if (!token || !isUUIDv4(token)) {
    const html = buildHTML({
      title:        'Burn Chat — Session Unavailable | BAR Web',
      description:  'This Burn Chat link is invalid or the session has already expired and been permanently destroyed.',
      canonicalUrl: OG_SITE,
    });
    return res
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=300')   // 5 min — invalid tokens never become valid
      .status(200)
      .send(html);
  }

  const canonicalUrl = `${OG_SITE}/chat/${token}`;

  // ── Try to get live session data (non-blocking, 2.5 s timeout) ──────────
  const info = await fetchSessionInfo(token);

  let title, description;

  if (!info) {
    // Backend unreachable (sleeping) or session already burned.
    // Serve a compelling generic Burn Chat card — still far better than the
    // global "Self-Destructing Files" defaults shown by index.html.
    title       = 'Join Burn Chat — Encrypted Ephemeral Session | BAR Web';
    description =
      "You've been invited to a Burn Chat — end-to-end encrypted ephemeral " +
      "messaging that self-destructs when the timer expires. No logs, no history, " +
      "no traces. Messages encrypted in your browser with ECDH P-256 + AES-GCM.";
  } else {
    // Live session data — build a specific, time-aware card.
    const secs      = Math.max(0, Number(info.seconds_remaining) || 0);
    const mins      = Math.max(1, Math.round(secs / 60));
    const count     = Number(info.participant_count) || 0;
    const pluralM   = mins  !== 1 ? 's' : '';
    const pluralP   = count !== 1 ? 's' : '';
    const pNote     = count > 0 ? `${count} person${pluralP} already inside. ` : '';

    title       = `Join Burn Chat — ${mins} min${pluralM} remaining | BAR Web`;
    description =
      `You've been invited to a Burn Chat — end-to-end encrypted ephemeral ` +
      `messaging that self-destructs in ${mins} minute${pluralM}. ` +
      `${pNote}` +
      `No logs, no history. Messages encrypted with ECDH P-256 + AES-GCM.`;
  }

  const html = buildHTML({ title, description, canonicalUrl });

  return res
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    // private — session state changes as participants join/leave and time passes.
    // 30 s lets crawlers reuse the card briefly without it going stale.
    .setHeader('Cache-Control', 'private, max-age=30')
    .status(200)
    .send(html);
}
