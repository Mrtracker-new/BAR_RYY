import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const DEFAULT_SITE_URL = "https://bar-rnr.vercel.app";

/**
 * SEO
 * ---
 * Centralised meta-tag and structured-data manager.
 * Renders into <head> via react-helmet-async.
 *
 * Props
 * -----
 * title        Page <title> and og:title / twitter:title.
 * description  Meta description, og:description, twitter:description.
 * keywords     Meta keywords string (comma-separated).
 * author       Meta author name.
 * authorUrl    <link rel="author"> href.
 * ogImage      Absolute URL for og:image / twitter:image.
 *              Defaults to https://bar-rnr.vercel.app/og-image.png.
 * ogImageAlt   Alt text for the OG image (accessibility + Twitter).
 * url          Canonical URL, og:url, twitter:url. Defaults to current route.
 * type         og:type — "website" (default) | "article" | etc.
 * noIndex      When true, adds <meta name="robots" content="noindex,nofollow">.
 *              Use for ephemeral / token-gated pages that must not be crawled.
 * jsonLd       Optional JSON-LD structured data object or array of schema objects.
 */
const SEO = ({
  title       = "BAR by Rolan — Burn After Reading | Self-Destructing Files & Encrypted Chat",
  description = "BAR by Rolan (Burn After Reading) — Send files that self-destruct after viewing, or start an ephemeral Burn Chat that permanently erases itself when the timer expires. Military-grade AES-256 encryption, E2E encrypted messaging with ECDH key exchange, password protection, and zero-knowledge security.",
  keywords    = "BAR by Rolan, BAR Rolan, burn after reading, BAR rnr, Rolan BAR, self-destruct files, secure file sharing, encrypted file sharing, AES-256 encryption, zero-knowledge encryption, password protected files, temporary file sharing, self-destructing messages, burn chat, ephemeral chat, encrypted chat room, e2e encrypted messaging, disappearing messages, ECDH key exchange",
  author      = "Rolan (RNR)",
  authorUrl   = "https://rolan-rnr.netlify.app/",
  ogImage     = `${DEFAULT_SITE_URL}/og-image.png`,
  ogImageAlt  = "BAR by Rolan — Burn After Reading",
  url,
  type        = "website",
  noIndex     = false,
  jsonLd      = null,
}) => {
  let location;
  try {
    location = useLocation();
  } catch {
    location = null;
  }

  // Determine canonical URL: explicit prop -> current route -> site root
  const canonicalUrl =
    url ||
    (location?.pathname
      ? `${DEFAULT_SITE_URL}${location.pathname === "/" ? "" : location.pathname}`
      : DEFAULT_SITE_URL);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title"       content={title} />
      <meta name="description" content={description} />
      <meta name="keywords"    content={keywords} />
      <meta name="author"      content={author} />
      <link rel="author"       href={authorUrl} />

      {/* Indexing & Rich Snippet Directives */}
      {noIndex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook / LinkedIn / WhatsApp */}
      <meta property="og:type"               content={type} />
      <meta property="og:url"                content={canonicalUrl} />
      <meta property="og:title"              content={title} />
      <meta property="og:description"        content={description} />
      <meta property="og:image"              content={ogImage} />
      <meta property="og:image:secure_url"   content={ogImage} />
      <meta property="og:image:type"         content="image/png" />
      <meta property="og:image:width"        content="1200" />
      <meta property="og:image:height"       content="630" />
      <meta property="og:image:alt"          content={ogImageAlt} />
      <meta property="og:site_name"          content="BAR by Rolan" />
      <meta property="og:locale"             content="en_US" />

      {/* Twitter / X */}
      <meta property="twitter:card"          content="summary_large_image" />
      <meta property="twitter:url"           content={canonicalUrl} />
      <meta property="twitter:title"         content={title} />
      <meta property="twitter:description"   content={description} />
      <meta property="twitter:image"         content={ogImage} />
      <meta property="twitter:image:alt"     content={ogImageAlt} />
      <meta name="twitter:creator"           content="@rolan_rnr" />
      <meta name="twitter:site"              content="@rolan_rnr" />

      {/* Dynamic Structured Data / JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
