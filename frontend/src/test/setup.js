import '@testing-library/jest-dom';

// Ensure window.crypto and window.crypto.subtle use Node's native Web Crypto API in jsdom
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    window.crypto = globalThis.crypto;
  } else if (!window.crypto.subtle && globalThis.crypto?.subtle) {
    const subtle = globalThis.crypto.subtle;

    // In Node.js 20, SubtleCrypto methods strictly validate that BufferSource arguments
    // belong to the Node.js root realm. In JSDOM, ArrayBuffers created in the window context
    // fail `instanceof ArrayBuffer` checks in Node 20.
    // This proxy normalizes ArrayBuffer and TypedArray arguments to Node-compatible Buffers.
    const normalizeArg = (arg) => {
      if (!arg) return arg;
      if (typeof ArrayBuffer !== 'undefined' && arg instanceof ArrayBuffer) {
        return Buffer.from(arg);
      }
      if (ArrayBuffer.isView(arg) && !(arg instanceof Buffer)) {
        return Buffer.from(arg.buffer, arg.byteOffset, arg.byteLength);
      }
      if (typeof arg === 'object') {
        const copy = { ...arg };
        if (copy.iv) {
          copy.iv = normalizeArg(copy.iv);
        }
        if (copy.salt) {
          copy.salt = normalizeArg(copy.salt);
        }
        if (copy.info) {
          copy.info = normalizeArg(copy.info);
        }
        return copy;
      }
      return arg;
    };

    window.crypto.subtle = new Proxy(subtle, {
      get(target, prop) {
        const orig = target[prop];
        if (typeof orig !== 'function') return orig;
        return function (...args) {
          return orig.apply(target, args.map(normalizeArg));
        };
      },
    });
  }
}
