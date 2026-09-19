import { describe, it, expect } from 'vitest';
import * as E2E from '../crypto/burnChatE2E';

describe('burnChatE2E Web Crypto Utilities', () => {
  it('isAvailable returns true in test environment with Web Crypto', () => {
    expect(E2E.isAvailable()).toBe(true);
  });

  it('generates an ECDH key pair with extractable public key and unextractable private key', async () => {
    const keyPair = await E2E.generateKeyPair();
    expect(keyPair).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.publicKey.extractable).toBe(true);
    expect(keyPair.privateKey.extractable).toBe(false);
  });

  it('exports and imports ECDH public keys cleanly', async () => {
    const keyPair = await E2E.generateKeyPair();
    const exportedB64 = await E2E.exportPublicKey(keyPair.publicKey);
    expect(typeof exportedB64).toBe('string');
    expect(exportedB64.length).toBeGreaterThan(0);

    const importedKey = await E2E.importPublicKey(exportedB64);
    expect(importedKey).toBeDefined();
    expect(importedKey.algorithm.name).toBe('ECDH');
  });

  it('performs end-to-end ECDH key agreement and HKDF key wrapping between two peers', async () => {
    // Alice and Bob generate keypairs
    const aliceKeyPair = await E2E.generateKeyPair();
    const bobKeyPair = await E2E.generateKeyPair();

    // Alice creates a random session key for the room
    const originalSessionKey = await E2E.generateSessionKey();
    expect(originalSessionKey).toBeDefined();

    // Alice exports her public key to Bob, Bob exports his to Alice
    const alicePubB64 = await E2E.exportPublicKey(aliceKeyPair.publicKey);
    const bobPubB64 = await E2E.exportPublicKey(bobKeyPair.publicKey);

    const aliceImportedByBob = await E2E.importPublicKey(alicePubB64);
    const bobImportedByAlice = await E2E.importPublicKey(bobPubB64);

    // Alice derives wrap key and wraps the session key for Bob
    const aliceWrapKey = await E2E.deriveWrapKey(aliceKeyPair.privateKey, bobImportedByAlice);
    const wrappedSessionKeyB64 = await E2E.wrapSessionKey(originalSessionKey, aliceWrapKey);
    expect(typeof wrappedSessionKeyB64).toBe('string');

    // Bob derives wrap key using his private key and Alice's public key
    const bobWrapKey = await E2E.deriveWrapKey(bobKeyPair.privateKey, aliceImportedByBob);
    const bobUnwrappedKey = await E2E.unwrapSessionKey(wrappedSessionKeyB64, bobWrapKey);
    expect(bobUnwrappedKey).toBeDefined();

    // Bob should now be able to decrypt a message from Alice using the unwrapped key
    const secretMessage = 'Antigravity confidential message';
    const { ciphertext, iv } = await E2E.encryptMessage(secretMessage, originalSessionKey);

    const decrypted = await E2E.decryptMessage(ciphertext, iv, bobUnwrappedKey);
    expect(decrypted).toBe(secretMessage);
  });

  it('encrypts and decrypts AES-GCM messages with authentication integrity', async () => {
    const sessionKey = await E2E.generateSessionKey();
    const text = 'Burn After Reading real-time message';

    const { ciphertext, iv } = await E2E.encryptMessage(text, sessionKey);
    expect(typeof ciphertext).toBe('string');
    expect(typeof iv).toBe('string');

    const decrypted = await E2E.decryptMessage(ciphertext, iv, sessionKey);
    expect(decrypted).toBe(text);

    // Tampering with ciphertext should throw an error
    const tamperedCiphertext = ciphertext.slice(0, -4) + 'AAAA';
    await expect(E2E.decryptMessage(tamperedCiphertext, iv, sessionKey)).rejects.toThrow();
  });

  it('computes a consistent 16-character hex fingerprint from session key', async () => {
    const sessionKey = await E2E.generateSessionKey();
    const fp1 = await E2E.sessionFingerprint(sessionKey);
    const fp2 = await E2E.sessionFingerprint(sessionKey);

    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
    expect(/^[0-9A-F]{16}$/.test(fp1)).toBe(true);
  });
});
