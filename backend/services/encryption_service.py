"""Encryption and BAR file management service."""
import os
import uuid
import base64
import hashlib
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
from fastapi import HTTPException

import crypto_utils
import client_storage
import server_storage
import database
from core.config import settings


class EncryptionService:
    """Service for encryption, decryption, and BAR file management."""
    
    def __init__(self):
        self.generated_dir = settings.generated_dir
    
    async def create_bar_file(
        self,
        file_data: bytes,
        filename: str,
        max_views: int,
        expiry_minutes: int,
        password: Optional[str],
        webhook_url: Optional[str],
        view_only: bool,
        storage_mode: str,
        require_otp: bool = False,
        otp_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create an encrypted BAR file.
        
        Args:
            file_data: Raw file bytes
            filename: Original filename
            max_views: Maximum number of views allowed
            expiry_minutes: Expiry time in minutes (0 = no expiry)
            password: Optional password protection
            webhook_url: Optional webhook for notifications
            view_only: Whether file should be view-only (no download)
            storage_mode: 'client' or 'server'
            require_otp: Whether to require 2FA
            otp_email: Email for OTP delivery
            
        Returns:
            Dictionary with BAR file information
        """
        # Calculate file hash
        file_hash = crypto_utils.calculate_file_hash(file_data)
        
        # Generate password hash if provided
        password_hash = None
        if password:
            password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        # Create metadata based on storage mode
        if storage_mode == 'server':
            metadata = server_storage.create_server_metadata(
                filename=filename,
                max_views=max_views,
                expiry_minutes=expiry_minutes,
                password_protected=bool(password),
                webhook_url=webhook_url,
                view_only=view_only
            )
        else:
            metadata = client_storage.create_client_metadata(
                filename=filename,
                expiry_minutes=expiry_minutes,
                password_protected=bool(password),
                webhook_url=webhook_url,
                view_only=view_only
            )
        
        metadata["file_hash"] = file_hash
        if password_hash:
            metadata["password_hash"] = password_hash
        
        # Create .BAR file
        if password:
            # Password-derived encryption
            bar_data, salt, key = crypto_utils.encrypt_and_pack_with_password(
                file_data,
                metadata,
                password
            )
        else:
            # No password: Use random key
            key = crypto_utils.generate_key()
            encrypted_data = crypto_utils.encrypt_file(file_data, key)
            bar_data = crypto_utils.pack_bar_file(encrypted_data, metadata, key)
        
        # Generate unique BAR ID
        bar_id = str(uuid.uuid4())
        bar_filename = f"{os.path.splitext(filename)[0]}_{bar_id[:8]}.bar"
        bar_path = os.path.join(self.generated_dir, bar_filename)
        
        # Save .bar file
        with open(bar_path, "wb") as f:
            f.write(bar_data)
        
        return {
            "bar_id": bar_id,
            "bar_filename": bar_filename,
            "bar_path": bar_path,
            "bar_data": bar_data,
            "metadata": metadata
        }
    
    async def create_server_side_file(
        self,
        bar_result: Dict[str, Any],
        filename: str,
        require_otp: bool,
        otp_email: Optional[str],
        frontend_base_url: str
    ) -> Dict[str, Any]:
        """
        Process server-side file storage.
        
        Args:
            bar_result: Result from create_bar_file()
            filename: Original filename
            require_otp: Whether 2FA is required
            otp_email: Email for OTP
            frontend_base_url: Base URL for share links
            
        Returns:
            Dictionary with access token and share URL
        """
        # Generate access token
        access_token = str(uuid.uuid4())
        token_bar_filename = f"{access_token}.bar"
        token_bar_path = os.path.join(self.generated_dir, token_bar_filename)
        
        # Rename the bar file to use token
        os.rename(bar_result["bar_path"], token_bar_path)
        
        # Save file record to database
        await database.db.create_file_record(
            token=access_token,
            filename=filename,
            bar_filename=token_bar_filename,
            file_path=token_bar_path,
            metadata=bar_result["metadata"],
            require_otp=require_otp,
            otp_email=otp_email
        )
        
        print(f"✅ Server-side file created: {access_token}")
        
        # Generate shareable link
        share_link = f"{frontend_base_url.rstrip('/')}/share/{access_token}"
        
        return {
            "access_token": access_token,
            "share_url": share_link,
            "bar_filename": token_bar_filename
        }
    
    def decrypt_bar_file(
        self,
        bar_data: bytes,
        password: Optional[str] = None
    ) -> Tuple[bytes, Dict[str, Any], bytes]:
        """
        Decrypt a BAR file.
        
        Args:
            bar_data: Encrypted BAR file bytes
            password: Optional password for decryption
            
        Returns:
            Tuple of (decrypted_data, metadata, key)
            
        Raises:
            HTTPException: If decryption fails or file integrity check fails
        """
        # Unpack BAR file
        password_to_use = password.strip() if password and password.strip() else None
        
        try:
            encrypted_data, metadata, key = crypto_utils.unpack_bar_file(
                bar_data, 
                password=password_to_use
            )
        except ValueError as e:
            error_msg = str(e)
            if "Password required" in error_msg:
                raise HTTPException(status_code=403, detail="Password required")
            elif "Invalid password" in error_msg:
                raise HTTPException(status_code=403, detail="Invalid password")
            else:
                raise HTTPException(status_code=403, detail="Decryption failed")
        except crypto_utils.TamperDetectedException as e:
            raise HTTPException(
                status_code=403, 
                detail="File integrity check failed - possible tampering"
            )
        
        # Decrypt file
        try:
            decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail="Decryption failed - invalid key or corrupted file"
            )
        
        # Verify file integrity
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get("file_hash"):
            raise HTTPException(
                status_code=500, 
                detail="File integrity check failed - possible tampering"
            )
        
        return decrypted_data, metadata, key


# Singleton instance
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get the encryption service singleton instance."""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
