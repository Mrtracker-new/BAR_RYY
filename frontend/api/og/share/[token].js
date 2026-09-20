/**
 * Vercel Serverless Function — Secure File Share OG Preview Page
 *
 * GET /api/og/share/[token]
 *
 * Purpose
 * -------
 * WhatsApp, Telegram, Twitter/X, Discord, Slack, iMessage and other social
 * platforms use crawlers that fetch the raw HTML of a shared URL and parse
 * <meta property="og:*"> tags. Because the frontend is a React SPA, raw
 * /share/:token hits return index.html carrying only generic homepage meta.
 *
 * This function returns a targeted HTML page with "Secure File Waiting" meta tags
 * and og-image so recipients see a compelling, confidential preview card.
 *
 * Browser flow
 * ------------
 * Real browsers follow <meta http-equiv="refresh" content="0;url=/share/:token">
 * and land on the SPA instantly.
 * Social bots stop at the meta tags and parse the card.
 */

const OG_SITE      = process.env.VITE_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://bar-rnr.vercel.app';
const OG_IMAGE     = `${OG_SITE}/og-image.png`;
const OG_IMAGE_ALT = 'Secure Encrypted File Waiting — BAR by Rolan';
const OG_SITE_NAME = 'BAR by Rolan';

function escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#x27;');
}

/** Return true only for well-formed UUID v4 strings. */
function isUUIDv4(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(token)
  );
}

function buildHTML({ title, description, canonicalUrl, redirectPath }) {
  const t       = escape(title);
  const d       = escape(description);
  const url     = escape(canonicalUrl);
  const target  = escape(redirectPath || url);
  const img     = escape(OG_IMAGE);
  const alt     = escape(OG_IMAGE_ALT);
  const sn      = escape(OG_SITE_NAME);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t}</title>

  <!-- Ephemeral confidential links must not be indexed -->
  <meta name="robots" content="noindex,nofollow">

  <!-- Canonical -->
  <link rel="canonical" href="${url}">

  <!-- Open Graph -->
  <meta property="og:type"               content="website">
  <meta property="og:url"                content="${url}">
  <meta property="og:site_name"          content="${sn}">
  <meta property="og:title"              content="${t}">
  <meta property="og:description"        content="${d}">
  <meta property="og:image"              content="${img}">
  <meta property="og:image:secure_url"   content="${img}">
  <meta property="og:image:alt"          content="${alt}">
  <meta property="og:image:width"        content="1200">
  <meta property="og:image:height"       content="630">
  <meta property="og:image:type"         content="image/png">
  <meta property="og:locale"             content="en_US">

  <!-- Twitter / X -->
  <meta name="twitter:card"              content="summary_large_image">
  <meta name="twitter:url"               content="${url}">
  <meta name="twitter:title"             content="${t}">
  <meta name="twitter:description"       content="${d}">
  <meta name="twitter:image"             content="${img}">
  <meta name="twitter:image:alt"         content="${alt}">
  <meta name="twitter:creator"           content="@rolan_rnr">
  <meta name="twitter:site"              content="@rolan_rnr">

  <!-- Instant redirect for real browsers. Social bots ignore this. -->
  <meta http-equiv="refresh" content="0;url=${target}">
</head>
<body>
  <p>
    Redirecting to secure file&hellip;
    <a href="${target}">Click here if not redirected.</a>
  </p>
</body>
</html>`;
}

export default function handler(req, res) {
  const { token } = req.query;

  // ── Invalid / missing token ──────────────────────────────────────────────
  if (!token || !isUUIDv4(token)) {
    const html = buildHTML({
      title:        'Secure File Access — BAR Web',
      description:  'This file link is invalid or the file has already expired and been permanently destroyed.',
      canonicalUrl: OG_SITE,
      redirectPath: '/',
    });
    return res
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=300')
      .status(200)
      .send(html);
  }

  const canonicalUrl = `${OG_SITE}/share/${token}`;
  const redirectPath = `/share/${token}`;
  const title        = 'Secure Encrypted File Waiting — BAR Web';
  const description  =
    'You have a confidential file waiting. Protected by military-grade AES-256 ' +
    'encryption. This file permanently self-destructs after viewing — open before it vanishes.';

  const html = buildHTML({ title, description, canonicalUrl, redirectPath });

  return res
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .setHeader('Cache-Control', 'private, max-age=60')
    .status(200)
    .send(html);
}
