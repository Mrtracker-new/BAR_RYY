import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('calls onFileSelect when a file is chosen via file input', () => {
    const handleFileSelect = vi.fn();
    render(<FileUpload onFileSelect={handleFileSelect} uploadedFile={null} />);

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();

    const file = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(handleFileSelect).toHaveBeenCalledWith(file);
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
});
