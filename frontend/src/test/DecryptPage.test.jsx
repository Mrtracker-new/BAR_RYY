import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DecryptPage from '../components/DecryptPage';

describe('DecryptPage Component', () => {
  it('renders decrypt title, upload section, and onBack button', () => {
    const handleBack = vi.fn();
    render(<DecryptPage onBack={handleBack} />);

    expect(screen.getByText(/Decrypt \.BAR File/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to select \.bar file/i)).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /Back to Create/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalled();
  });

  it('rejects files that do not end with .bar extension', () => {
    render(<DecryptPage onBack={vi.fn()} />);

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();

    const invalidFile = new File(['dummy'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(screen.getByText(/Please select a \.bar file/i)).toBeInTheDocument();
  });
});
