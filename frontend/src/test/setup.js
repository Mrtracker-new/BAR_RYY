import '@testing-library/jest-dom';

// Ensure window.crypto and window.crypto.subtle use Node's native Web Crypto API in jsdom
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    window.crypto = globalThis.crypto;
  } else if (!window.crypto.subtle && globalThis.crypto?.subtle) {
    window.crypto.subtle = globalThis.crypto.subtle;
  }
}
