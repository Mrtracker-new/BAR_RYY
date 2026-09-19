import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WakeUpButton, { getBackendHealthUrl, COOLDOWN_KEY } from '../components/WakeUpButton';

describe('WakeUpButton Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders in idle state initially', () => {
    render(<WakeUpButton />);

    const button = screen.getByRole('button', { name: /wake server/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('Wake Server');
  });

  it('resolves correct health check URL', () => {
    const url = getBackendHealthUrl();
    expect(typeof url).toBe('string');
    expect(url.endsWith('/health')).toBe(true);
  });

  it('transitions to loading upon click and polls until success', async () => {
    // First attempt fails (e.g. 502 booting), second attempt succeeds (200 OK with valid health json)
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy', service: 'BAR Web API' }),
      });

    render(<WakeUpButton />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Should immediately enter loading state
    expect(screen.getByText('Waking…')).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Advance timers for first fetch attempt to complete
    await act(async () => {
      await Promise.resolve();
    });

    // Advance timers by POLL_INTERVAL_MS (3000ms) for second poll
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Should transition to success
    expect(screen.getByText('Ready!')).toBeInTheDocument();
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeTruthy();

    // Advance 3000ms past the success display window
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should enter cooldown state
    expect(screen.getByText(/Wait \d+s/)).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('ignores false-positive HTML responses (SPA fallbacks) and keeps polling until genuine API responds', async () => {
    // First response is 200 OK HTML (e.g. index.html from SPA rewrite), json() throws
    // Second response is genuine health JSON
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token <'); },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });

    render(<WakeUpButton />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // After first poll returns HTML, should still be in loading state
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Waking…')).toBeInTheDocument();

    // Advance to second poll
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    // Now genuine API responded, should be Ready!
    expect(screen.getByText('Ready!')).toBeInTheDocument();
  });

  it('enters cooldown state on mount if cooldown is active', () => {
    const recentTime = Date.now() - 10_000; // 10s ago, 20s left
    localStorage.setItem(COOLDOWN_KEY, recentTime.toString());

    render(<WakeUpButton />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText(/Wait \d+s/)).toBeInTheDocument();

    // Advance timers to expire cooldown (21s)
    act(() => {
      vi.advanceTimersByTime(21_000);
    });

    // Should return to idle
    expect(screen.getByText('Wake Server')).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('handles timeout failure and transitions to error state', async () => {
    global.fetch.mockRejectedValue(new Error('Network failure'));

    render(<WakeUpButton />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Waking…')).toBeInTheDocument();

    // Advance past MAX_WAKE_TIME_MS (75_000ms)
    for (let i = 0; i < 26; i++) {
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
    }

    expect(screen.getByText('Failed — Retry')).toBeInTheDocument();

    // Error state resets to idle after 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByText('Wake Server')).toBeInTheDocument();
  });
});
