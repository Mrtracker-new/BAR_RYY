import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileUpload from '../components/FileUpload';

describe('FileUpload Component', () => {
  it('renders drop zone when no file is selected', () => {
    render(<FileUpload onFileSelect={vi.fn()} uploadedFile={null} />);

    expect(screen.getByText(/Drop file or click to browse/i)).toBeInTheDocument();
    expect(screen.getByText(/Any file type supported/i)).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Archives')).toBeInTheDocument();
  });

  it('calls onFileSelect when a file with valid magic bytes is chosen via file input', async () => {
    const handleFileSelect = vi.fn();
    render(<FileUpload onFileSelect={handleFileSelect} uploadedFile={null} />);

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();

    // %PDF-1.4 header
    const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const file = new File([validPdfBytes], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(handleFileSelect).toHaveBeenCalledWith(file);
    });
  });

  it('rejects a spoofed file and displays validation error alert', async () => {
    const handleFileSelect = vi.fn();
    const handleError = vi.fn();
    render(
      <FileUpload
        onFileSelect={handleFileSelect}
        onError={handleError}
        uploadedFile={null}
      />
    );

    const input = document.querySelector('input[type="file"]');
    // Mislabeled as PDF, but content is text without %PDF header
    const spoofedFile = new File(['not a real pdf content'], 'fake.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [spoofedFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/PDF format/i);
    expect(handleError).toHaveBeenCalledWith(expect.stringContaining('PDF format'));
    expect(handleFileSelect).not.toHaveBeenCalled();
  });

  it('rejects an executable disguised as a PDF via magic byte check', async () => {
    const handleFileSelect = vi.fn();
    const handleError = vi.fn();
    render(
      <FileUpload
        onFileSelect={handleFileSelect}
        onError={handleError}
        uploadedFile={null}
      />
    );

    const input = document.querySelector('input[type="file"]');
    // MZ header (DOS/PE executable)
    const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const disguisedExe = new File([exeBytes], 'document.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [disguisedExe] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/Security violation: Windows\/DOS Executable/i);
    expect(handleError).toHaveBeenCalledWith(expect.stringContaining('Security violation'));
    expect(handleFileSelect).not.toHaveBeenCalled();
  });

  it('renders uploaded file details, size, and remove button when file is selected', () => {
    const handleRemove = vi.fn();
    const file = new File(['dummy content'], 'confidential.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    render(
      <FileUpload
        onFileSelect={vi.fn()}
        uploadedFile={file}
        onRemove={handleRemove}
      />
    );

    expect(screen.getByText('confidential.docx')).toBeInTheDocument();
    expect(screen.getByText(/Document/i)).toBeInTheDocument();

    const removeBtn = screen.getByTitle('Remove file');
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalled();
  });

  it('allows re-selecting the same file after removing it', async () => {
    const handleFileSelect = vi.fn();
    const handleRemove = vi.fn();
    const { rerender } = render(
      <FileUpload onFileSelect={handleFileSelect} uploadedFile={null} onRemove={handleRemove} />
    );

    const input = document.querySelector('input[type="file"]');
    const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const file = new File([validPdfBytes], 'report.pdf', { type: 'application/pdf' });

    // 1. Select file
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(handleFileSelect).toHaveBeenCalledTimes(1));

    // 2. Simulate parent setting uploadedFile
    rerender(<FileUpload onFileSelect={handleFileSelect} uploadedFile={file} onRemove={handleRemove} />);
    const removeBtn = screen.getByTitle('Remove file');
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);

    // 3. Simulate parent resetting uploadedFile to null
    rerender(<FileUpload onFileSelect={handleFileSelect} uploadedFile={null} onRemove={handleRemove} />);
    const newInput = document.querySelector('input[type="file"]');

    // 4. Select the exact same file again
    fireEvent.change(newInput, { target: { files: [file] } });
    await waitFor(() => expect(handleFileSelect).toHaveBeenCalledTimes(2));
  });
});
