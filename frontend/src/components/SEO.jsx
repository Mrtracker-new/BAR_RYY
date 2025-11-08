import React from "react";
import { Helmet } from "react-helmet-async";

const SEO = ({
  title = "BAR - Burn After Reading | Secure Self-Destructing File Sharing & Encryption",
  description = "BAR (Burn After Reading) - Send files that self-destruct after viewing. Military-grade AES-256 encryption, password protection, and automatic deletion. Secure, private, and zero-knowledge file sharing for sensitive documents.",
  keywords = "BAR, burn after reading, BAR rnr, self-destruct files, secure file sharing, encrypted file sharing, AES-256 encryption, zero-knowledge encryption, password protected files, temporary file sharing, self-destructing messages, mission impossible files, secure file transfer, confidential file sharing, auto-delete files, burn after reading app",
  author = "Rolan (RNR)",
  authorUrl = "https://rolan-rnr.netlify.app/",
  ogImage = "https://bar-dusky.vercel.app/og-image.png",
  url = "https://bar-dusky.vercel.app/",
  type = "website",
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <link rel="author" href={authorUrl} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default SEO;
