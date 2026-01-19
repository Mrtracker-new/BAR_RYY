"""File operations service."""
import os
import uuid
import base64
from io import BytesIO
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from core.config import settings
from core import security


class FileService:
    """Service for file operations like upload, preview generation, etc."""
    
    def __init__(self):
        self.upload_dir = settings.upload_dir
        self.generated_dir = settings.generated_dir
    
    async def save_uploaded_file(
        self, 
        file: UploadFile,
        validate: bool = True
    ) -> Tuple[str, str, int, Optional[str]]:
        """
        Save an uploaded file to the upload directory.
        
        Args:
            file: FastAPI UploadFile object
            validate: Whether to validate filename and extension
            
        Returns:
            Tuple of (file_id, safe_filename, file_size, preview_data)
            
        Raises:
            HTTPException: If validation fails or file is too large
        """
        if validate:
            # Validate filename
            if not security.validate_filename(file.filename):
                raise HTTPException(status_code=400, detail="Invalid filename")
            
            # Validate file extension
            if not security.validate_file_extension(file.filename):
                raise HTTPException(status_code=400, detail="File type not allowed")
        
        # Sanitize filename
        safe_filename = security.sanitize_filename(file.filename)
        
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        temp_filename = f"{file_id}__{safe_filename}"
        temp_path = os.path.join(self.upload_dir, temp_filename)
        
        # Save file with size limit
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(chunk_size):
                file_size += len(chunk)
                if file_size > settings.max_file_size:
                    # Clean up partial file
                    buffer.close()
                    os.remove(temp_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {settings.max_file_size // (1024*1024)}MB"
                    )
                buffer.write(chunk)
        
        # Generate preview
        preview_data = self.generate_preview(temp_path, file.content_type)
        
        return file_id, safe_filename, file_size, preview_data
    
    def generate_preview(self, file_path: str, content_type: Optional[str]) -> Optional[str]:
        """
        Generate a preview for image files.
        
        Args:
            file_path: Path to the file
            content_type: MIME type of the file
            
        Returns:
            Base64-encoded preview image or None
        """
        if not PIL_AVAILABLE or not content_type:
            return None
        
        try:
            if content_type.startswith('image/'):
                # Image preview
                img = Image.open(file_path)
                # Create thumbnail (max 300x300)
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                # Convert to base64
                buffer_io = BytesIO()
                img_format = img.format or 'PNG'
                img.save(buffer_io, format=img_format)
                preview_data = f"data:image/{img_format.lower()};base64," + base64.b64encode(buffer_io.getvalue()).decode()
                return preview_data
            elif content_type.startswith('video/'):
                # Video preview - skip for now to avoid heavy dependencies
                print(f"Video upload detected - thumbnail generation skipped")
                return None
        except Exception as e:
            print(f"Preview generation failed: {e}")
            return None
        
        return None
    
    def find_uploaded_file(self, filename: str) -> Optional[str]:
        """
        Find an uploaded file by its original filename.
        
        Args:
            filename: Original filename to search for
            
        Returns:
            Full path to the file or None if not found
        """
        # Look for file that ends with __{original_filename}
        for file in os.listdir(self.upload_dir):
            if file.endswith(f"__{filename}"):
                return os.path.join(self.upload_dir, file)
        
        return None
    
    def get_bar_file_path(self, bar_id: str) -> Optional[str]:
        """
        Find a BAR file by its ID.
        
        Args:
            bar_id: BAR file identifier
            
        Returns:
            Full path to the BAR file or None if not found
        """
        for filename in os.listdir(self.generated_dir):
            if bar_id[:8] in filename and filename.endswith('.bar'):
                return os.path.join(self.generated_dir, filename)
        
        return None


# Singleton instance
_file_service: Optional[FileService] = None


def get_file_service() -> FileService:
    """Get the file service singleton instance."""
    global _file_service
    if _file_service is None:
        _file_service = FileService()
    return _file_service
