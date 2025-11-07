import React from "react";
import { Helmet } from "react-helmet-async";

const SEO = ({
  title = "BAR Web - Burn After Reading | Military-Grade File Encryption & Self-Destruct",
  description = "Secure file encryption with AES-256 military-grade protection. Share files that self-destruct after viewing. Zero-knowledge encryption, password protection, and automatic file deletion for maximum security.",
  keywords = "secure file sharing, file encryption, AES-256, self-destruct files, burn after reading, zero-knowledge encryption, password protected files, secure file transfer, encrypted file sharing, temporary file sharing, mission impossible files",
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
