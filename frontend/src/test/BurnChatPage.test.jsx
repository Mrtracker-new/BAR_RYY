import { describe, it, expect } from 'vitest';
import { resolveWsUrl } from '../components/BurnChatPage';

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
});
