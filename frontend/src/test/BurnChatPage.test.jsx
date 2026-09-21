import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import BurnChatPage, { resolveWsUrl } from '../components/BurnChatPage';
import * as E2E from '../crypto/burnChatE2E';
import axios from '../config/axios';

vi.mock('../components/SEO', () => ({
  default: () => null,
}));

vi.mock('../config/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('BurnChatPage Utilities & Security', () => {
  describe('resolveWsUrl', () => {
    it('upgrades http:// to wss:// when page is served over https:', () => {
      const url = resolveWsUrl('http://api.burnafterreading.net', 'https:');
      expect(url).toBe('wss://api.burnafterreading.net');
    });

    it('uses ws:// when both page and backend are http:', () => {
      const url = resolveWsUrl('http://localhost:8000', 'http:');
      expect(url).toBe('ws://localhost:8000');
    });

    it('preserves wss:// when backend is https:', () => {
      const url = resolveWsUrl('https://api.burnafterreading.net', 'https:');
      expect(url).toBe('wss://api.burnafterreading.net');
    });

    it('strips trailing slashes cleanly', () => {
      const url = resolveWsUrl('https://api.burnafterreading.net///', 'https:');
      expect(url).toBe('wss://api.burnafterreading.net');
    });
  });

  describe('E2EE Downgrade Protection', () => {
    let originalWebSocket;
    let mockWsInstances = [];

    beforeEach(() => {
      mockWsInstances = [];
      axios.get.mockResolvedValue({
        data: { exists: true, seconds_remaining: 300, participant_count: 1 },
      });
      originalWebSocket = globalThis.WebSocket;
      globalThis.WebSocket = class MockWebSocket {
        static OPEN = 1;
        constructor(url) {
          this.url = url;
          this.readyState = 1; // WebSocket.OPEN
          this.send = vi.fn();
          this.close = vi.fn();
          mockWsInstances.push(this);
          setTimeout(() => {
            if (this.onopen) this.onopen();
          }, 0);
        }
      };
      globalThis.WebSocket.OPEN = 1;
    });

    afterEach(() => {
      cleanup();
      globalThis.WebSocket = originalWebSocket;
      vi.restoreAllMocks();
    });

    it('blocks plaintext transmission and displays a blocking security banner when crypto is unavailable', async () => {
      // Mock E2E.isAvailable to return false (e.g. insecure context / no subtle crypto)
      vi.spyOn(E2E, 'isAvailable').mockReturnValue(false);

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="test-token" />);

      // Wait for session info to resolve so "Join Session" becomes enabled
      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Alice' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      // Simulate WS connection and server sending 'joined' event
      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'alice_ws_1',
          participant_id: 'alice_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 1,
          participant_list: [],
        }),
      });

      // Verify the degradation banner is displayed with transmission blocked warning
      await screen.findByText(/E2E encryption unavailable/i);
      expect(screen.getByText(/Message transmission blocked/i)).toBeInTheDocument();

      // Attempt to type and send a message
      const chatInput = screen.getByLabelText(/Chat message/i);
      fireEvent.change(chatInput, { target: { value: 'Secret plaintext message' } });

      // Trigger sendMessage via Enter key
      fireEvent.keyDown(chatInput, { key: 'Enter', shiftKey: false });

      // Verify that no raw plaintext send message was transmitted over WebSocket
      expect(mockWs.send).not.toHaveBeenCalledWith(
        JSON.stringify({ type: 'send', text: 'Secret plaintext message' })
      );

      // Verify the blocking security banner is displayed
      await screen.findByText(/End-to-End Encryption is unavailable in this browsing context\. Message transmission blocked\./i);
    });
  });

  describe('E2EE Session Key Concurrency Guard', () => {
    let originalWebSocket;
    let mockWsInstances = [];

    beforeEach(() => {
      mockWsInstances = [];
      axios.get.mockResolvedValue({
        data: { exists: true, seconds_remaining: 300, participant_count: 2 },
      });
      originalWebSocket = globalThis.WebSocket;
      globalThis.WebSocket = class MockWebSocket {
        static OPEN = 1;
        constructor(url) {
          this.url = url;
          this.readyState = 1;
          this.send = vi.fn();
          this.close = vi.fn();
          mockWsInstances.push(this);
          setTimeout(() => {
            if (this.onopen) this.onopen();
          }, 0);
        }
      };
      globalThis.WebSocket.OPEN = 1;
    });

    afterEach(() => {
      cleanup();
      globalThis.WebSocket = originalWebSocket;
      vi.restoreAllMocks();
    });

    it('ignores redundant session_key frames when unwrap is already in progress or completed', async () => {
      let resolveUnwrap;
      const unwrapPromise = new Promise(resolve => {
        resolveUnwrap = resolve;
      });

      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('alice_pub_b64');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      const unwrapSpy = vi.spyOn(E2E, 'unwrapSessionKey').mockImplementation(() => unwrapPromise);
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="concurrency-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Bob' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'bob_ws_1',
          participant_id: 'bob_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 2,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub_b64' }],
        }),
      });

      // Wait for async keypair generation and pubkey broadcast to finish
      await waitFor(() => expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pubkey"')
      ));

      // Send first session_key frame (triggers async unwrap)
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'wrapped_key_frame_1',
        }),
      });

      // Send second session_key frame while first is still unwrapping
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'wrapped_key_frame_2',
        }),
      });

      // Resolve the initial unwrap
      resolveUnwrap({ algorithm: { name: 'AES-GCM' } });
      await waitFor(() => expect(unwrapSpy).toHaveBeenCalledTimes(1));

      // Send a third session_key frame after initial unwrap has finished
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'wrapped_key_frame_3',
        }),
      });

      // Should still be exactly 1 call (redundant frames ignored)
      expect(unwrapSpy).toHaveBeenCalledTimes(1);
    });

    it('parks session_key if it arrives before keyPair is generated and resolves once keyPair is ready', async () => {
      let resolveKeyPair;
      const keyPairPromise = new Promise(resolve => {
        resolveKeyPair = resolve;
      });

      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockImplementation(() => keyPairPromise);
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('alice_pub_b64');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      const unwrapSpy = vi.spyOn(E2E, 'unwrapSessionKey').mockResolvedValue({ algorithm: { name: 'AES-GCM' } });
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="pre-keypair-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Charlie' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'charlie_ws_1',
          participant_id: 'charlie_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 2,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub_b64' }],
        }),
      });

      // session_key arrives BEFORE keyPair finishes generating
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'wrapped_key_frame_pre',
        }),
      });

      // At this point, keyPair hasn't finished, so unwrap shouldn't have been called yet
      expect(unwrapSpy).not.toHaveBeenCalled();

      // Now resolve keyPair generation
      resolveKeyPair({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });

      // Once keyPair resolves, the parked key should be unwrapped!
      await waitFor(() => expect(unwrapSpy).toHaveBeenCalledTimes(1));
    });

    it('accepts new session_key if creator reconnects with a new ws_id', async () => {
      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('alice_pub_b64');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      const unwrapSpy = vi.spyOn(E2E, 'unwrapSessionKey').mockResolvedValue({ algorithm: { name: 'AES-GCM' } });
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="reconnect-creator-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Dave' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'dave_ws_1',
          participant_id: 'dave_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 2,
          participant_list: [
            { ws_id: 'creator_old', public_key: 'creator_old_pub' },
            { ws_id: 'creator_new', public_key: 'creator_new_pub' },
          ],
        }),
      });

      await waitFor(() => expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pubkey"')
      ));

      // Key from first creator
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_old',
          wrapped_key: 'key_1',
        }),
      });

      await waitFor(() => expect(unwrapSpy).toHaveBeenCalledTimes(1));

      // Redundant frame from same creator is ignored
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_old',
          wrapped_key: 'key_1',
        }),
      });
      expect(unwrapSpy).toHaveBeenCalledTimes(1);

      // Reconnected creator with new ws_id sends new session_key
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_new',
          wrapped_key: 'key_2',
        }),
      });

      // New creator's key should be accepted
      await waitFor(() => expect(unwrapSpy).toHaveBeenCalledTimes(2));
    });

    it('surfaces error banner if session key unwrapping throws', async () => {
      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('alice_pub_b64');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      vi.spyOn(E2E, 'unwrapSessionKey').mockRejectedValue(new Error('Corrupt key'));

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="error-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Eve' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'eve_ws_1',
          participant_id: 'eve_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 2,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub_b64' }],
        }),
      });

      await waitFor(() => expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pubkey"')
      ));

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'corrupt_key',
        }),
      });

      await screen.findByText(/Failed to establish secure encryption key\. Please reconnect\./i);
    });

    it('ensures non-creator participant does not wrap and send session_key upon receiving peer pubkey', async () => {
      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('frank_pub_b64');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      vi.spyOn(E2E, 'unwrapSessionKey').mockResolvedValue({ algorithm: { name: 'AES-GCM' } });
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');
      const wrapSpy = vi.spyOn(E2E, 'wrapSessionKey');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="participant-not-creator-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Frank' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      // Join as regular participant (is_creator: false)
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'frank_ws_1',
          participant_id: 'frank_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 2,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub_b64' }],
        }),
      });

      await waitFor(() => expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pubkey"')
      ));

      // Creator delivers session key
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'session_key_for_frank',
        }),
      });

      // Wait until participant is ready with sessionKey
      await screen.findByText(/0123-4567-89AB-CDEF/);

      // Now a third peer joins and broadcasts their pubkey
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'pubkey',
          ws_id: 'grace_ws_1',
          public_key: 'grace_pub_b64',
        }),
      });

      // Frank (participant) must NOT attempt to wrap or send a session key to Grace
      expect(wrapSpy).not.toHaveBeenCalled();
      expect(mockWs.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"for_ws_id":"grace_ws_1"')
      );
    });

    it('ensures creator wraps and sends session key to peers who broadcast pubkey while key generation is in flight', async () => {
      let resolveKeyGen;
      const keyGenPromise = new Promise(resolve => {
        resolveKeyGen = resolve;
      });

      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockImplementation(() => keyGenPromise);
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('creator_pub_b64');
      vi.spyOn(E2E, 'generateSessionKey').mockResolvedValue({ algorithm: { name: 'AES-GCM' } });
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      const wrapSpy = vi.spyOn(E2E, 'wrapSessionKey').mockResolvedValue('wrapped_for_peer_late');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="creator-race-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'CreatorAlice' } });

      const creatorChk = screen.getByLabelText(/I'm the creator/i);
      fireEvent.click(creatorChk);

      const pinInput = await screen.findByPlaceholderText(/XXXXXX/i);
      fireEvent.change(pinInput, { target: { value: '123456' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      // Creator joins - participant_list has NO peers initially
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'creator_ws_1',
          participant_id: 'creator_ws_1',
          is_creator: true,
          seconds_remaining: 300,
          participant_count: 1,
          participant_list: [],
        }),
      });

      // Peer broadcast arrives WHILE creator's keypair generation is still pending
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'pubkey',
          ws_id: 'late_peer_ws_1',
          public_key: 'late_peer_pub_b64',
        }),
      });

      // Wrap shouldn't be called yet because key generation hasn't resolved
      expect(wrapSpy).not.toHaveBeenCalled();

      // Now resolve keypair generation
      resolveKeyGen({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });

      // Creator should deliver session_key to the peer who arrived during key generation!
      await waitFor(() => {
        expect(mockWs.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: 'session_key',
            for_ws_id: 'late_peer_ws_1',
            wrapped_key: 'wrapped_for_peer_late',
          })
        );
      });
      expect(wrapSpy).toHaveBeenCalledTimes(1);
    });

    it('prevents automatic reconnection when session is destroyed', async () => {
      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('pub');
      vi.spyOn(E2E, 'generateSessionKey').mockResolvedValue({});
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="destroy-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'User1' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'user_1',
          participant_id: 'user_1',
          is_creator: false,
          seconds_remaining: 10,
          participant_count: 1,
          participant_list: [],
        }),
      });

      // Server sends destroyed frame
      mockWs.onmessage({
        data: JSON.stringify({ type: 'destroyed' }),
      });

      // Server closes WS
      mockWs.onclose({ code: 1000, reason: 'Session expired' });

      // Ensure no new WebSocket connection was created
      expect(mockWsInstances.length).toBe(1);
    });

    it('preserves own message bubble ownership across reconnections with a new ws_id', async () => {
      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('pub');
      vi.spyOn(E2E, 'generateSessionKey').mockResolvedValue({});
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      vi.spyOn(E2E, 'unwrapSessionKey').mockResolvedValue({ algorithm: { name: 'AES-GCM' } });
      vi.spyOn(E2E, 'decryptMessage').mockResolvedValue('My message before reconnect');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="bubble-ownership-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'ReconnectingUser' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      let mockWs = mockWsInstances[0];

      // 1. Initial join with ws_id_1
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'ws_id_1',
          participant_id: 'ws_id_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 1,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub' }],
        }),
      });

      // Receive a message sent by ws_id_1
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'message',
          id: 'msg_1',
          sender_id: 'ws_id_1',
          sender_name: 'ReconnectingUser',
          ciphertext: 'cipher_1',
          iv: 'iv_1',
          sent_at: new Date().toISOString(),
        }),
      });

      // Deliver key so Bubble decrypts
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'wrapped_key_1',
        }),
      });

      await screen.findByText('My message before reconnect');

      // 2. Reconnect: server issues a new ws_id_2
      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'ws_id_2',
          participant_id: 'ws_id_2',
          is_creator: false,
          seconds_remaining: 290,
          participant_count: 1,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub' }],
        }),
      });

      // The message sent under ws_id_1 should STILL be recognized as "isMe" (no sender header rendered)
      // When !isMe, sender_name is rendered in a <span> above the bubble.
      // When isMe, sender_name is NOT rendered above the bubble.
      expect(screen.queryByText(/ReconnectingUser 👑/)).not.toBeInTheDocument();
      // Only the bubble text itself should be present, not an external sender header
      expect(screen.getByText('My message before reconnect')).toBeInTheDocument();
    });

    it('prevents double message sending via isSendingRef guard', async () => {
      let resolveEncrypt;
      const encryptPromise = new Promise(resolve => {
        resolveEncrypt = resolve;
      });

      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('pub');
      vi.spyOn(E2E, 'generateSessionKey').mockResolvedValue({});
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');
      vi.spyOn(E2E, 'importPublicKey').mockResolvedValue({});
      vi.spyOn(E2E, 'deriveWrapKey').mockResolvedValue({});
      vi.spyOn(E2E, 'unwrapSessionKey').mockResolvedValue({ algorithm: { name: 'AES-GCM' } });
      const encryptSpy = vi.spyOn(E2E, 'encryptMessage').mockImplementation(() => encryptPromise);

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      render(<BurnChatPage token="double-send-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Sender' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));
      const mockWs = mockWsInstances[0];

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'joined',
          ws_id: 'sender_ws_1',
          participant_id: 'sender_ws_1',
          is_creator: false,
          seconds_remaining: 300,
          participant_count: 2,
          participant_list: [{ ws_id: 'creator_1', public_key: 'creator_pub' }],
        }),
      });

      mockWs.onmessage({
        data: JSON.stringify({
          type: 'session_key',
          from_ws_id: 'creator_1',
          wrapped_key: 'key_1',
        }),
      });

      await screen.findByText(/0123-4567-89AB-CDEF/);

      const chatInput = screen.getByLabelText(/Chat message/i);
      fireEvent.change(chatInput, { target: { value: 'Hello world' } });

      // Press Enter twice rapidly
      fireEvent.keyDown(chatInput, { key: 'Enter', shiftKey: false });
      fireEvent.keyDown(chatInput, { key: 'Enter', shiftKey: false });

      // Encrypt should only be called once because the first is still in flight
      expect(encryptSpy).toHaveBeenCalledTimes(1);

      // Resolve encryption
      resolveEncrypt({ ciphertext: 'ct_1', iv: 'iv_1' });

      await waitFor(() => {
        expect(mockWs.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'send', ciphertext: 'ct_1', iv: 'iv_1' })
        );
      });
      expect(encryptSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('In-Memory Cryptographic Key Scrubbing on Component Unmount', () => {
    let originalWebSocket;
    let mockWsInstances = [];

    beforeEach(() => {
      mockWsInstances = [];
      axios.get.mockResolvedValue({
        data: { exists: true, seconds_remaining: 300, participant_count: 2 },
      });
      originalWebSocket = globalThis.WebSocket;
      globalThis.WebSocket = class MockWebSocket {
        static OPEN = 1;
        constructor(url) {
          this.url = url;
          this.readyState = 1;
          this.send = vi.fn();
          this.close = vi.fn();
          mockWsInstances.push(this);
          setTimeout(() => {
            if (this.onopen) this.onopen();
          }, 0);
        }
      };
      globalThis.WebSocket.OPEN = 1;
    });

    afterEach(() => {
      cleanup();
      globalThis.WebSocket = originalWebSocket;
      vi.restoreAllMocks();
    });

    it('scrubs key material and clears peer maps/sets on component unmount', async () => {
      const mapClearSpy = vi.spyOn(Map.prototype, 'clear');
      const setClearSpy = vi.spyOn(Set.prototype, 'clear');

      vi.spyOn(E2E, 'isAvailable').mockReturnValue(true);
      vi.spyOn(E2E, 'generateKeyPair').mockResolvedValue({
        publicKey: { extractable: true },
        privateKey: { extractable: false },
      });
      vi.spyOn(E2E, 'exportPublicKey').mockResolvedValue('pub');
      vi.spyOn(E2E, 'generateSessionKey').mockResolvedValue({});
      vi.spyOn(E2E, 'sessionFingerprint').mockResolvedValue('0123456789ABCDEF');

      const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
      const BurnChatPage = (await import('../components/BurnChatPage')).default;

      const { unmount } = render(<BurnChatPage token="scrub-test-token" />);

      const nameInput = await screen.findByPlaceholderText(/Your name…/i);
      fireEvent.change(nameInput, { target: { value: 'Alice' } });

      const joinBtn = screen.getByRole('button', { name: /Join Session/i });
      fireEvent.click(joinBtn);

      await waitFor(() => expect(mockWsInstances.length).toBeGreaterThan(0));

      unmount();

      expect(mapClearSpy).toHaveBeenCalled();
      expect(setClearSpy).toHaveBeenCalled();
    });
  });
});


