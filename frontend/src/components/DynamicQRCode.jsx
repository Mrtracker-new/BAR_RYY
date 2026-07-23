/**
 * DynamicQRCode — Production-grade client-side QR code generator.
 *
 * Renders a QR code with an embedded centre logo, matching the visual quality
 * of the previous server-side PIL/Pillow-generated QR.
 *
 * Why client-side?
 * ────────────────
 * The backend previously baked the full URL (including host) into the QR at
 * seal-time. If the user accessed the site at http://localhost:5173 the QR
 * encoded that — which was unreachable from other devices on the LAN.
 *
 * By generating the QR in the browser we use `window.location.origin`
 * automatically, so the URL always matches whatever host the viewer is on
 * (localhost for dev, LAN IP for local network, production domain for prod).
 *
 * Technical notes
 * ───────────────
 * • Error correction level H (30%) — sufficient headroom for a ~14% centre
 *   logo overlay without compromising scannability.
 * • Canvas renders at 2× the display size for retina / high-DPI screens.
 * • Logo is loaded from /bar-logo.png (copied from backend/BAR_web.png into
 *   frontend/public/ at build time).
 * • If logo fails to load the QR renders without it — graceful degradation.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import QRCode from "qrcode";

/* ── Shared logo image cache ──────────────────────────────────
   Avoids re-fetching the logo on every mount / re-render.
   Singleton Promise — resolved once, cached forever.            */
let _logoCachePromise = null;

function loadLogo(src) {
  if (_logoCachePromise) return _logoCachePromise;

  _logoCachePromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // graceful degradation
    img.src = src;
  });

  return _logoCachePromise;
}

/* ── Constants ────────────────────────────────────────────── */
const LOGO_PATH          = "/bar-logo.png";
const LOGO_RATIO         = 1 / 7;           // ~14% of QR — matches backend
const LOGO_PADDING_PX    = 10;              // white circle padding around logo (scaled)
const SHADOW_BLUR_RADIUS = 3;               // subtle shadow behind logo circle
const QR_MARGIN          = 2;               // quiet zone modules (spec minimum is 4, but 2 is fine with the outer container)

/**
 * @param {object}  props
 * @param {string}  props.path         – URL path (e.g. "/share/abc-123")
 * @param {number}  [props.size=160]   – Display width/height in CSS pixels
 * @param {string}  [props.alt]        – Alt text
 * @param {object}  [props.style]      – Extra inline styles on the <canvas>
 * @param {boolean} [props.withLogo=true] – Whether to overlay the BAR logo
 */
export default function DynamicQRCode({
  path,
  size = 160,
  alt = "QR Code — scan to open the share link",
  style = {},
  withLogo = true,
}) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Memoize the full URL so the effect only re-runs when path actually changes
  const fullUrl = useMemo(
    () => `${window.location.origin}${path}`,
    [path]
  );

  // Pixel ratio for retina rendering
  const dpr = useMemo(
    () => Math.min(window.devicePixelRatio || 1, 3),
    []
  );

  const renderQR = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderSize = Math.round(size * dpr);

    // 1. Render the raw QR onto the canvas via the qrcode library
    await QRCode.toCanvas(canvas, fullUrl, {
      errorCorrectionLevel: "H",
      margin: QR_MARGIN,
      width: renderSize,
      color: { dark: "#000000", light: "#ffffff" },
    });

    // 2. Overlay the logo if requested
    if (withLogo) {
      const logoImg = await loadLogo(LOGO_PATH);
      if (logoImg) {
        compositeLogoOnCanvas(canvas, logoImg, renderSize);
      }
    }

    setReady(true);
  }, [fullUrl, size, dpr, withLogo]);

  useEffect(() => {
    setReady(false);
    renderQR();
  }, [renderQR]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      style={{
        width: size,
        height: size,
        display: "block",
        imageRendering: "pixelated",
        opacity: ready ? 1 : 0,
        transition: "opacity 0.2s ease",
        ...style,
      }}
    />
  );
}

/* ── Logo compositing ─────────────────────────────────────────
   Mirrors the backend's PIL approach:
   1. Calculate logo size at ~14% of QR dimension
   2. Draw a white circle with subtle shadow behind the logo
   3. Draw the logo centred on top                               */
function compositeLogoOnCanvas(canvas, logoImg, canvasSize) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Logo dimensions — match backend: min(w,h) // 7
  const logoSize = Math.floor(canvasSize * LOGO_RATIO);
  const padding  = LOGO_PADDING_PX * (canvasSize / 320); // scale padding relative to canvas
  const bgSize   = logoSize + padding * 2;

  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // --- White circle background with subtle shadow ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, bgSize / 2, 0, Math.PI * 2);
  ctx.closePath();

  // Shadow (matches backend's GaussianBlur(2))
  ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
  ctx.shadowBlur = SHADOW_BLUR_RADIUS * (canvasSize / 320);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // --- Draw logo centred ---
  // Maintain aspect ratio
  const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
  let drawW, drawH;
  if (aspectRatio >= 1) {
    drawW = logoSize;
    drawH = logoSize / aspectRatio;
  } else {
    drawH = logoSize;
    drawW = logoSize * aspectRatio;
  }

  const logoX = cx - drawW / 2;
  const logoY = cy - drawH / 2;

  ctx.drawImage(logoImg, logoX, logoY, drawW, drawH);
}
