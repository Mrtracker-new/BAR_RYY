import { describe, it, expect } from 'vitest';
import {
  readMagicBytes,
  detectDangerousSignature,
  verifyExtensionMagicBytes,
  validateFile,
  ALLOWED_FILE_EXTENSIONS,
} from '../utils/fileValidation';

describe('fileValidation utility', () => {
  describe('readMagicBytes', () => {
    it('reads initial bytes using FileReader.readAsArrayBuffer', async () => {
      const uint8 = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = new File([uint8], 'test.pdf', { type: 'application/pdf' });

      const bytes = await readMagicBytes(file, 4);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(4);
      expect(Array.from(bytes)).toEqual([0x25, 0x50, 0x44, 0x46]);
    });

    it('rejects on invalid file object', async () => {
      await expect(readMagicBytes(null)).rejects.toThrow('Invalid file object');
    });
  });

  describe('detectDangerousSignature', () => {
    it('detects DOS/Windows executable (MZ)', () => {
      const bytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
      expect(detectDangerousSignature(bytes)).toContain('Windows/DOS Executable');
    });

    it('detects Linux ELF executable', () => {
      const bytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
      expect(detectDangerousSignature(bytes)).toContain('Linux ELF Executable');
    });

    it('detects macOS Mach-O executable', () => {
      const bytes = new Uint8Array([0xfe, 0xed, 0xfa, 0xce, 0x00, 0x00]);
      expect(detectDangerousSignature(bytes)).toContain('macOS Mach-O');
    });

    it('detects Java Class file (CAFEBABE)', () => {
      const bytes = new Uint8Array([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x03]);
      expect(detectDangerousSignature(bytes)).toContain('Java Class');
    });

    it('detects Shell script shebang', () => {
      const bytes = new Uint8Array([0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e]);
      expect(detectDangerousSignature(bytes)).toContain('Shell Script');
    });

    it('detects Windows Shortcut (LNK)', () => {
      const bytes = new Uint8Array([0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00]);
      expect(detectDangerousSignature(bytes)).toContain('Windows Shortcut');
    });

    it('detects Windows Help File (CHM/ITSF)', () => {
      const bytes = new Uint8Array([0x49, 0x54, 0x53, 0x46, 0x01, 0x00]);
      expect(detectDangerousSignature(bytes)).toContain('Windows Help');
    });

    it('detects WebAssembly Binary (WASM)', () => {
      const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00]);
      expect(detectDangerousSignature(bytes)).toContain('WebAssembly Binary');
    });

    it('returns null for safe files', () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      expect(detectDangerousSignature(pdfBytes)).toBeNull();
    });
  });

  describe('verifyExtensionMagicBytes', () => {
    it('verifies valid PDF magic bytes (%PDF)', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      expect(verifyExtensionMagicBytes('.pdf', bytes)).toEqual({ matches: true });
    });

    it('rejects PDF with mismatched magic bytes', () => {
      const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const result = verifyExtensionMagicBytes('.pdf', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('PDF');
    });

    it('verifies valid PNG magic bytes', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(verifyExtensionMagicBytes('.png', bytes)).toEqual({ matches: true });
    });

    it('verifies valid JPEG magic bytes', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(verifyExtensionMagicBytes('.jpg', bytes)).toEqual({ matches: true });
      expect(verifyExtensionMagicBytes('.jpeg', bytes)).toEqual({ matches: true });
    });

    it('verifies valid GIF magic bytes', () => {
      const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(verifyExtensionMagicBytes('.gif', bytes)).toEqual({ matches: true });
    });

    it('verifies valid BMP magic bytes (BM)', () => {
      const bytes = new Uint8Array([0x42, 0x4d, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00]);
      expect(verifyExtensionMagicBytes('.bmp', bytes)).toEqual({ matches: true });
    });

    it('verifies valid WebP magic bytes (RIFF....WEBP)', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x24, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(verifyExtensionMagicBytes('.webp', bytes)).toEqual({ matches: true });
    });

    it('verifies valid ZIP / Office document magic bytes (PK)', () => {
      const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(verifyExtensionMagicBytes('.zip', bytes)).toEqual({ matches: true });
      expect(verifyExtensionMagicBytes('.docx', bytes)).toEqual({ matches: true });
      expect(verifyExtensionMagicBytes('.xlsx', bytes)).toEqual({ matches: true });
      expect(verifyExtensionMagicBytes('.pptx', bytes)).toEqual({ matches: true });
    });

    it('verifies valid 7z and RAR magic bytes', () => {
      const bytes7z = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
      expect(verifyExtensionMagicBytes('.7z', bytes7z)).toEqual({ matches: true });

      const bytesRar = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]);
      expect(verifyExtensionMagicBytes('.rar', bytesRar)).toEqual({ matches: true });
    });

    it('verifies valid MP4 magic bytes (ftyp at offset 4)', () => {
      const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);
      expect(verifyExtensionMagicBytes('.mp4', bytes)).toEqual({ matches: true });
    });

    it('rejects truncated MP4 files (< 8 bytes)', () => {
      const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66]);
      const result = verifyExtensionMagicBytes('.mp4', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('MP4');
    });

    it('rejects truncated WebP files (< 12 bytes)', () => {
      const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00]);
      const result = verifyExtensionMagicBytes('.webp', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('WebP');
    });

    it('verifies valid WAV and AVI magic bytes with RIFF sub-type', () => {
      const wavBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x24, 0x00, 0x00, 0x00, // size
        0x57, 0x41, 0x56, 0x45, // WAVE
      ]);
      expect(verifyExtensionMagicBytes('.wav', wavBytes)).toEqual({ matches: true });

      const aviBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x24, 0x00, 0x00, 0x00, // size
        0x41, 0x56, 0x49, 0x20, // AVI 
      ]);
      expect(verifyExtensionMagicBytes('.avi', aviBytes)).toEqual({ matches: true });
    });

    it('rejects text files containing binary headers', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF inside .txt
      const result = verifyExtensionMagicBytes('.txt', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('Binary content detected in text file');
    });

    it('rejects text files containing null bytes in header', () => {
      const bytes = new Uint8Array([0x00, 0x48, 0x65, 0x6c]);
      const result = verifyExtensionMagicBytes('.txt', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('Null byte detected');
    });

    it('rejects text files containing GZIP header', () => {
      const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
      const result = verifyExtensionMagicBytes('.txt', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('Binary content detected in text file');
    });
  });

  describe('validateFile integration', () => {
    it('accepts a valid PDF file with %PDF magic bytes', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const file = new File([content], 'annual_report.pdf', { type: 'application/pdf' });

      const result = await validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('rejects a spoofed PDF containing plain text (mismatched magic bytes)', async () => {
      const file = new File(['This is plain text, not a PDF'], 'malicious.pdf', {
        type: 'application/pdf',
      });

      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('PDF format (%PDF signature missing)');
    });

    it('rejects an executable disguised with a .pdf extension (MZ header)', async () => {
      const peContent = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const file = new File([peContent], 'invoice.pdf', { type: 'application/pdf' });

      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Security violation: Windows/DOS Executable');
    });

    it('rejects an ELF executable disguised as an image', async () => {
      const elfContent = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x01, 0x01, 0x00]);
      const file = new File([elfContent], 'avatar.png', { type: 'image/png' });

      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Security violation: Linux ELF Executable');
    });

    it('rejects files with disallowed extensions (.exe)', async () => {
      const file = new File(['binary'], 'program.exe', { type: 'application/octet-stream' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File type ".exe" is not allowed');
    });

    it('rejects files with dangerous MIME types', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const file = new File([content], 'report.pdf', {
        type: 'application/x-msdownload',
      });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Disallowed MIME type');
    });

    it('rejects empty files (0 bytes)', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('rejects files without extensions', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const file = new File([content], 'noextension', { type: 'application/pdf' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid filename and extension');
    });

    it('handles filenames with leading or trailing whitespace', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      const file = new File([content], '  document.pdf  ', { type: 'application/pdf' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('rejects files exceeding MAX_FILE_SIZE (50MB)', async () => {
      const file = new File(['header'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 55 * 1024 * 1024 });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('rejects truncated WAV files (< 12 bytes)', () => {
      const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10]);
      const result = verifyExtensionMagicBytes('.wav', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('WAV');
    });

    it('rejects truncated MP3 files (< 2 bytes)', () => {
      const bytes = new Uint8Array([0xff]);
      const result = verifyExtensionMagicBytes('.mp3', bytes);
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('MP3');
    });

    it('rejects dotfiles without base names (e.g. .pdf)', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      const file = new File([content], '.pdf', { type: 'application/pdf' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('valid filename and extension');
    });

    it('rejects filenames with path traversal sequences', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      const file = new File([content], '../../etc/passwd.pdf', { type: 'application/pdf' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('rejects filenames exceeding MAX_FILENAME_LENGTH (255 chars)', async () => {
      const longName = 'a'.repeat(252) + '.pdf'; // 256 chars
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
      const file = new File([content], longName, { type: 'application/pdf' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('maximum 255 characters');
    });

    it('allows .ppt, .pptx, and .key presentation formats', async () => {
      expect(ALLOWED_FILE_EXTENSIONS.has('.ppt')).toBe(true);
      expect(ALLOWED_FILE_EXTENSIONS.has('.pptx')).toBe(true);
      expect(ALLOWED_FILE_EXTENSIONS.has('.key')).toBe(true);

      const pkBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const pptxFile = new File([pkBytes], 'slides.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const result = await validateFile(pptxFile);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('accepts PDF files with a UTF-8 BOM prefix', () => {
      const bomPdf = new Uint8Array([0xef, 0xbb, 0xbf, 0x25, 0x50, 0x44, 0x46, 0x2d]);
      expect(verifyExtensionMagicBytes('.pdf', bomPdf)).toEqual({ matches: true });
    });

    it('accepts MP4 files starting with free or wide box', () => {
      const freeMp4 = new Uint8Array([0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65]);
      expect(verifyExtensionMagicBytes('.mp4', freeMp4)).toEqual({ matches: true });

      const wideMov = new Uint8Array([0x00, 0x00, 0x00, 0x08, 0x77, 0x69, 0x64, 0x65]);
      expect(verifyExtensionMagicBytes('.mov', wideMov)).toEqual({ matches: true });
    });

    it('rejects text files containing RIFF, BMP, or EBML headers', () => {
      const riffBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
      expect(verifyExtensionMagicBytes('.txt', riffBytes).matches).toBe(false);

      const bmpBytes = new Uint8Array([0x42, 0x4d, 0x00, 0x00]);
      expect(verifyExtensionMagicBytes('.md', bmpBytes).matches).toBe(false);

      const ebmlBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
      expect(verifyExtensionMagicBytes('.csv', ebmlBytes).matches).toBe(false);
    });

    it('accepts modern Office documents saved with legacy .doc extension (PK container)', () => {
      const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(verifyExtensionMagicBytes('.doc', bytes)).toEqual({ matches: true });
    });

    it('rejects filenames containing CRLF and line terminators', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const fileCr = new File([content], 'report\rX-Injected.pdf', { type: 'application/pdf' });
      const fileLf = new File([content], 'document\nSet-Cookie.pdf', { type: 'application/pdf' });
      expect((await validateFile(fileCr)).isValid).toBe(false);
      expect((await validateFile(fileCr)).error).toContain('illegal control characters');
      expect((await validateFile(fileLf)).isValid).toBe(false);
      expect((await validateFile(fileLf)).error).toContain('illegal control characters');
    });

    it('rejects filenames containing Unicode direction overrides (RLO)', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const fileRlo = new File([content], 'file_\u202E_exe.pdf', { type: 'application/pdf' });
      const result = await validateFile(fileRlo);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('illegal control characters');
    });

    it('rejects files with newly added dangerous MIME types (msi, python bytecode)', async () => {
      const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      const fileMsi = new File([content], 'setup.pdf', { type: 'application/x-msi' });
      const filePyc = new File([content], 'code.pdf', { type: 'application/x-python-code' });
      expect((await validateFile(fileMsi)).isValid).toBe(false);
      expect((await validateFile(fileMsi)).error).toContain('Disallowed MIME type');
      expect((await validateFile(filePyc)).isValid).toBe(false);
      expect((await validateFile(filePyc)).error).toContain('Disallowed MIME type');
    });

    it('accepts a valid BMP file in validateFile', async () => {
      const bmpHeader = new Uint8Array([0x42, 0x4d, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00]);
      const file = new File([bmpHeader], 'image.bmp', { type: 'image/bmp' });
      const result = await validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('accepts legacy OLE Office file saved with modern .docx extension', () => {
      const oleBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      expect(verifyExtensionMagicBytes('.docx', oleBytes)).toEqual({ matches: true });
    });
  });
});
