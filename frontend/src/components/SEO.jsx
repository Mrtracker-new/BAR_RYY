import React from "react";
import { Helmet } from "react-helmet-async";

/**
 * SEO
 * ---
 * Centralised meta-tag manager. Renders into <head> via react-helmet-async.
 *
 * Props
 * -----
 * title        Page <title> and og:title / twitter:title.
 * description  Meta description, og:description, twitter:description.
 * keywords     Meta keywords string (comma-separated).
 * author       Meta author name.
 * authorUrl    <link rel="author"> href.
 * ogImage      Absolute URL for og:image / twitter:image.
 *              Defaults to the generic BAR OG image.
 * ogImageAlt   Alt text for the OG image (accessibility + Twitter).
 * url          Canonical URL, og:url, twitter:url.
 * type         og:type — "website" (default) | "article" | etc.
 * noIndex      When true, adds <meta name="robots" content="noindex,nofollow">.
 *              Use for ephemeral / token-gated pages that must not be crawled.
 */
const SEO = ({
  title       = "BAR by Rolan - Burn After Reading | Secure Self-Destructing File Sharing & Encryption",
  description = "BAR by Rolan (Burn After Reading) - Send files that self-destruct after viewing. Military-grade AES-256 encryption, password protection, and automatic deletion. Secure, private, and zero-knowledge file sharing for sensitive documents.",
  keywords    = "BAR by Rolan, BAR Rolan, burn after reading, BAR rnr, Rolan BAR, self-destruct files, secure file sharing, encrypted file sharing, AES-256 encryption, zero-knowledge encryption, password protected files, temporary file sharing, self-destructing messages, mission impossible files, secure file transfer, confidential file sharing, auto-delete files, burn after reading app",
  author      = "Rolan (RNR)",
  authorUrl   = "https://rolan-rnr.netlify.app/",
  ogImage     = "https://bar-rnr.vercel.app/og-image.png",
  ogImageAlt  = "BAR by Rolan — Burn After Reading",
  url         = "https://bar-rnr.vercel.app/",
  type        = "website",
  noIndex     = false,
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title"       content={title} />
      <meta name="description" content={description} />
      <meta name="keywords"    content={keywords} />
      <meta name="author"      content={author} />
      <link rel="author"       href={authorUrl} />

      {/* Indexing control — noindex for ephemeral / token-gated pages */}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Canonical URL */}
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type"        content={type} />
      <meta property="og:url"         content={url} />
      <meta property="og:title"       content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:image:alt"   content={ogImageAlt} />
      <meta property="og:site_name"   content="BAR by Rolan" />

      {/* Twitter */}
      <meta property="twitter:card"        content="summary_large_image" />
      <meta property="twitter:url"         content={url} />
      <meta property="twitter:title"       content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image"       content={ogImage} />
      <meta property="twitter:image:alt"   content={ogImageAlt} />
    </Helmet>
  );
};

export default SEO;
