/**
 * copyToClipboard(text) → Promise<boolean>
 *
 * Attempts to write *text* to the system clipboard using two strategies:
 *
 * 1. navigator.clipboard.writeText  — available only in secure contexts
 *    (HTTPS or localhost).  Preferred because it works in all modern browsers.
 *
 * 2. document.execCommand('copy') via a temporary off-screen <textarea> —
 *    the legacy fallback for HTTP pages, Safari's ITP sandbox, and older
 *    browsers where the Clipboard API is unavailable or restricted.
 *
 * Returns true if either strategy succeeded, false if both failed.
 * The caller is responsible for showing feedback to the user.
 */
export async function copyToClipboard(text) {
  // Strategy 1: Async Clipboard API (secure contexts only)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissions denied or unavailable — fall through to strategy 2.
    }
  }

  // Strategy 2: execCommand fallback (deprecated but widely supported)
  try {
    const ta = document.createElement('textarea');
    ta.value = text;

    // Position off-screen so it doesn't cause a layout shift or flash.
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    ta.setAttribute('aria-hidden', 'true');
    ta.setAttribute('readonly', '');

    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS Safari requires this

    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
