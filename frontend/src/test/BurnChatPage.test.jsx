import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveWsUrl } from '../components/BurnChatPage';
import * as E2E from '../crypto/burnChatE2E';

vi.mock('../components/SEO', () => ({
  default: () => null,
}));

vi.mock('../config/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { exists: true, seconds_remaining: 300, participant_count: 1 },
    }),
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
});
