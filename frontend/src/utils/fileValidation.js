/**
 * fileValidation.js — Client-side file validation and magic byte sniffing.
 *
 * Verifies file extension, browser MIME type, and inspects the initial 4–8 bytes
 * (up to 12 bytes for container formats like RIFF/MP4) using FileReader.readAsArrayBuffer.
 * Protects against mislabeled, spoofed, or executable files before client-side encryption.
 */

export const ALLOWED_FILE_EXTENSIONS = new Set([
  // Documents
  '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt',
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
  // Archives
  '.zip', '.rar', '.7z', '.tar', '.gz',
  // Media
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  // Data
  '.json', '.xml', '.csv', '.xlsx', '.xls',
  // Other
  '.ppt', '.pptx', '.key',
]);

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_FILENAME_LENGTH = 255;

export const DANGEROUS_SIGNATURES = [
  { name: 'Windows/DOS Executable (MZ)', pattern: [0x4d, 0x5a] },
  { name: 'Linux ELF Executable', pattern: [0x7f, 0x45, 0x4c, 0x46] },
  { name: 'macOS Mach-O Executable (32-bit)', pattern: [0xfe, 0xed, 0xfa, 0xce] },
  { name: 'macOS Mach-O Executable (64-bit)', pattern: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: 'macOS Mach-O Executable (reverse 32)', pattern: [0xce, 0xfa, 0xed, 0xfe] },
  { name: 'macOS Mach-O Executable (reverse 64)', pattern: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: 'Java Class / Mach-O Universal Binary', pattern: [0xca, 0xfe, 0xba, 0xbe] },
  { name: 'Shell Script Shebang', pattern: [0x23, 0x21] },
  { name: 'Windows Shortcut (LNK)', pattern: [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00] },
  { name: 'Windows Help File (CHM/ITSF)', pattern: [0x49, 0x54, 0x53, 0x46] },
  { name: 'WebAssembly Binary (WASM)', pattern: [0x00, 0x61, 0x73, 0x6d] },
];

/**
 * Match a pattern against a Uint8Array starting at a given offset.
 */
function matchesPattern(bytes, pattern, offset = 0) {
  if (!bytes || bytes.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== null && bytes[offset + i] !== pattern[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Read the initial bytes of a file via FileReader.readAsArrayBuffer.
 *
 * @param {Blob|File} file
 * @param {number} numBytes Default 12 to cover 4–8 byte signatures plus RIFF/MP4 offsets
 * @returns {Promise<Uint8Array>}
 */
export function readMagicBytes(file, numBytes = 16) {
  return new Promise((resolve, reject) => {
    if (!file || typeof file.slice !== 'function') {
      return reject(new Error('Invalid file object'));
    }

    const safeNumBytes = Math.max(1, Number(numBytes) || 16);
    const reader = new FileReader();
    const slice = file.slice(0, safeNumBytes);

    reader.onload = () => {
      const buffer = reader.result;
      resolve(buffer ? new Uint8Array(buffer) : new Uint8Array(0));
    };

    reader.onerror = () => {
      reject(new Error(reader.error?.message || 'Failed to read file header'));
    };

    reader.onabort = () => {
      reject(new Error('File reading was aborted'));
    };

    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Check if the byte buffer matches any known dangerous executable signatures.
 *
 * @param {Uint8Array} bytes
 * @returns {string|null} Dangerous signature name or null if safe
 */
export function detectDangerousSignature(bytes) {
  for (const sig of DANGEROUS_SIGNATURES) {
    if (matchesPattern(bytes, sig.pattern)) {
      return sig.name;
    }
  }
  return null;
}

/**
 * Verify whether the magic bytes match the expected signature for the extension.
 *
 * @param {string} ext Lowercase extension with dot, e.g. '.pdf'
 * @param {Uint8Array} bytes Initial bytes of file
 * @returns {{ matches: boolean, reason?: string }}
 */
export function verifyExtensionMagicBytes(ext, bytes) {
  if (!bytes || bytes.length === 0) {
    return { matches: false, reason: 'File is empty' };
  }

  switch (ext) {
    case '.pdf':
      // %PDF -> 0x25, 0x50, 0x44, 0x46 (at offset 0, or offset 3 if preceded by UTF-8 BOM)
      if (!matchesPattern(bytes, [0x25, 0x50, 0x44, 0x46]) &&
          !(matchesPattern(bytes, [0xef, 0xbb, 0xbf]) && matchesPattern(bytes, [0x25, 0x50, 0x44, 0x46], 3))) {
        return { matches: false, reason: 'File content does not match PDF format (%PDF signature missing)' };
      }
      return { matches: true };

    case '.png':
      // Full 8-byte PNG signature: \x89PNG\r\n\x1a\n
      if (!matchesPattern(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { matches: false, reason: 'File content does not match PNG format' };
      }
      return { matches: true };

    case '.jpg':
    case '.jpeg':
      // JPEG SOI -> 0xFF, 0xD8, 0xFF
      if (!matchesPattern(bytes, [0xff, 0xd8, 0xff])) {
        return { matches: false, reason: 'File content does not match JPEG format' };
      }
      return { matches: true };

    case '.gif':
      // GIF87a or GIF89a
      if (!matchesPattern(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) &&
          !matchesPattern(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
        return { matches: false, reason: 'File content does not match GIF format' };
      }
      return { matches: true };

    case '.bmp':
      // BM -> 0x42, 0x4D
      if (bytes.length < 2 || !matchesPattern(bytes, [0x42, 0x4d])) {
        return { matches: false, reason: 'File content does not match BMP format' };
      }
      return { matches: true };

    case '.webp':
      // RIFF....WEBP -> 0x52, 0x49, 0x46, 0x46 at 0, 0x57, 0x45, 0x42, 0x50 at 8
      if (bytes.length < 12 ||
          !matchesPattern(bytes, [0x52, 0x49, 0x46, 0x46]) ||
          !matchesPattern(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
        return { matches: false, reason: 'File content does not match WebP format' };
      }
      return { matches: true };

    case '.zip':
    case '.docx':
    case '.xlsx':
    case '.pptx':
    case '.odt':
    case '.key':
      // PK\x03\x04 or PK\x05\x06 or PK\x07\x08, or OLE CFBF for legacy Office docs renamed to modern extension
      if (!matchesPattern(bytes, [0x50, 0x4b, 0x03, 0x04]) &&
          !matchesPattern(bytes, [0x50, 0x4b, 0x05, 0x06]) &&
          !matchesPattern(bytes, [0x50, 0x4b, 0x07, 0x08]) &&
          !matchesPattern(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
        return { matches: false, reason: `File content does not match ${ext.slice(1).toUpperCase()} format (ZIP signature missing)` };
      }
      return { matches: true };

    case '.7z':
      // 7z\xbc\xaf\x27\x1c
      if (!matchesPattern(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
        return { matches: false, reason: 'File content does not match 7z format' };
      }
      return { matches: true };

    case '.rar':
      // Rar! -> 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07
      if (!matchesPattern(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) {
        return { matches: false, reason: 'File content does not match RAR format' };
      }
      return { matches: true };

    case '.gz':
      // 0x1F, 0x8B
      if (!matchesPattern(bytes, [0x1f, 0x8b])) {
        return { matches: false, reason: 'File content does not match Gzip format' };
      }
      return { matches: true };

    case '.doc':
    case '.xls':
    case '.ppt':
      // OLE CFBF: 0xD0, 0xCF, 0x11, 0xE0 or PK zip for modern Office docs saved with legacy extension
      if (!matchesPattern(bytes, [0xd0, 0xcf, 0x11, 0xe0]) &&
          !matchesPattern(bytes, [0x50, 0x4b, 0x03, 0x04])) {
        return { matches: false, reason: `File content does not match legacy MS Office ${ext.slice(1).toUpperCase()} format` };
      }
      return { matches: true };

    case '.rtf':
      // {\rt -> 0x7B, 0x5C, 0x72, 0x74
      if (!matchesPattern(bytes, [0x7b, 0x5c, 0x72, 0x74])) {
        return { matches: false, reason: 'File content does not match RTF format' };
      }
      return { matches: true };

    case '.mp3':
      // ID3 or MPEG frame sync (0xFF, 0xFB/F3/F2); requires at least 2 bytes
      if (bytes.length < 2 ||
          (!matchesPattern(bytes, [0x49, 0x44, 0x33]) &&
           !(bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0x00 && (bytes[1] & 0x18) !== 0x08))) {
        return { matches: false, reason: 'File content does not match MP3 format' };
      }
      return { matches: true };

    case '.mp4':
    case '.mov':
      // ftyp, moov, mdat, free, wide, or skip at offset 4; requires at least 8 bytes
      if (bytes.length < 8 ||
          (!matchesPattern(bytes, [0x66, 0x74, 0x79, 0x70], 4) &&
           !matchesPattern(bytes, [0x6d, 0x6f, 0x6f, 0x76], 4) &&
           !matchesPattern(bytes, [0x6d, 0x64, 0x61, 0x74], 4) &&
           !matchesPattern(bytes, [0x66, 0x72, 0x65, 0x65], 4) &&
           !matchesPattern(bytes, [0x77, 0x69, 0x64, 0x65], 4) &&
           !matchesPattern(bytes, [0x73, 0x6b, 0x69, 0x70], 4))) {
        return { matches: false, reason: `File content does not match ${ext.slice(1).toUpperCase()} format` };
      }
      return { matches: true };

    case '.wav':
      // RIFF/RF64 at 0, WAVE at 8; requires at least 12 bytes
      if (bytes.length < 12 ||
          (!matchesPattern(bytes, [0x52, 0x49, 0x46, 0x46]) && !matchesPattern(bytes, [0x52, 0x46, 0x36, 0x34])) ||
          !matchesPattern(bytes, [0x57, 0x41, 0x56, 0x45], 8)) {
        return { matches: false, reason: 'File content does not match WAV format' };
      }
      return { matches: true };

    case '.avi':
      // RIFF at 0, AVI  at 8; requires at least 12 bytes
      if (bytes.length < 12 ||
          !matchesPattern(bytes, [0x52, 0x49, 0x46, 0x46]) ||
          !matchesPattern(bytes, [0x41, 0x56, 0x49, 0x20], 8)) {
        return { matches: false, reason: 'File content does not match AVI format' };
      }
      return { matches: true };

    case '.mkv':
      // EBML -> 0x1A, 0x45, 0xDF, 0xA3
      if (!matchesPattern(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
        return { matches: false, reason: 'File content does not match MKV format' };
      }
      return { matches: true };

    case '.txt':
    case '.md':
    case '.csv':
    case '.json':
    case '.xml':
    case '.svg': {
      // Text formats must not start with a null byte (binary data)
      if (bytes[0] === 0x00) {
        return { matches: false, reason: 'Null byte detected in text file header' };
      }
      // Text formats must not match binary file signatures
      const binarySignatures = [
        [0x25, 0x50, 0x44, 0x46], // %PDF
        [0x89, 0x50, 0x4e, 0x47], // PNG
        [0xff, 0xd8, 0xff],       // JPEG
        [0x47, 0x49, 0x46, 0x38], // GIF
        [0x50, 0x4b, 0x03, 0x04], // ZIP
        [0x37, 0x7a, 0xbc, 0xaf], // 7z
        [0x52, 0x61, 0x72, 0x21], // RAR
        [0xd0, 0xcf, 0x11, 0xe0], // OLE
        [0x1f, 0x8b],             // GZIP
        [0x52, 0x49, 0x46, 0x46], // RIFF (WebP, WAV, AVI)
        [0x42, 0x4d],             // BMP
        [0x1a, 0x45, 0xdf, 0xa3], // EBML / MKV
      ];
      for (const bin of binarySignatures) {
        if (matchesPattern(bytes, bin)) {
          return { matches: false, reason: `Binary content detected in text file (${ext})` };
        }
      }
      return { matches: true };
    }

    default:
      return { matches: true };
  }
}

/**
 * Validate a file client-side before calling Web Crypto and initiating upload/encryption.
 *
 * Checks:
 * 1. File existence and non-zero size
 * 2. Filename length, path traversal, control chars, and extension presence/allowlist
 * 3. Browser-reported MIME type sanity
 * 4. Magic bytes sniffing via FileReader.readAsArrayBuffer (4–8+ bytes)
 * 5. Rejection of executable / dangerous signatures
 * 6. Match between magic bytes and declared extension
 *
 * @param {File} file
 * @returns {Promise<{ isValid: boolean, error: string | null }>}
 */
export async function validateFile(file) {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  if (typeof file.size !== 'number' || file.size <= 0) {
    return { isValid: false, error: 'File is empty (0 bytes)' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: 'File too large. Maximum size is 50MB' };
  }

  // 1. Validate filename and extension
  const filename = (file.name || '').trim();
  if (!filename || filename.length > MAX_FILENAME_LENGTH) {
    return { isValid: false, error: 'Invalid filename length (maximum 255 characters)' };
  }

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\x00')) {
    return { isValid: false, error: 'Filename contains illegal characters or path traversal sequences' };
  }

  if (/[\r\n\x85\u2028\u2029\u202A-\u202E]/.test(filename)) {
    return { isValid: false, error: 'Filename contains illegal control characters or line terminators' };
  }

  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return { isValid: false, error: 'File must have a valid filename and extension' };
  }

  const ext = filename.slice(lastDotIndex).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return { isValid: false, error: `File type "${ext}" is not allowed` };
  }

  // 2. Validate browser-reported MIME type
  const mime = (file.type || '').toLowerCase();
  const dangerousMimes = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-dosexec',
    'application/x-executable',
    'application/x-sharedlib',
    'application/x-pie-executable',
    'application/x-mach-binary',
    'application/x-msi',
    'application/x-python-code',
    'application/vnd.microsoft.portable-executable',
    'application/x-sh',
    'application/x-bat',
    'application/x-csh',
  ];
  if (dangerousMimes.some(d => mime.includes(d))) {
    return { isValid: false, error: `Disallowed MIME type: ${mime}` };
  }

  // 3. Read initial 4–8+ bytes via FileReader.readAsArrayBuffer
  let bytes;
  try {
    bytes = await readMagicBytes(file, 16);
  } catch (err) {
    return { isValid: false, error: `Could not read file header: ${err.message}` };
  }

  // 4. Reject dangerous executable headers
  const dangerous = detectDangerousSignature(bytes);
  if (dangerous) {
    return { isValid: false, error: `Security violation: ${dangerous} detected` };
  }

  // 5. Verify magic bytes match declared extension
  const matchResult = verifyExtensionMagicBytes(ext, bytes);
  if (!matchResult.matches) {
    return {
      isValid: false,
      error: `File validation failed: ${matchResult.reason || 'Mislabeled or spoofed file type'}`,
    };
  }

  return { isValid: true, error: null };
}
