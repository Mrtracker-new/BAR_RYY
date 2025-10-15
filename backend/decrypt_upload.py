"""
New endpoint to handle .bar file uploads for decryption
This ensures view counting works properly
"""
from fastapi import UploadFile, File, HTTPException
import crypto_utils
import os


async def decrypt_uploaded_bar(file: UploadFile, password: str = None):
    """
    Decrypt a .bar file that was uploaded
    Returns decrypted data and metadata
    """
    try:
        # Read uploaded .bar file
        bar_data = await file.read()
        
        # Unpack BAR file
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        # Validate access
        is_valid, errors = crypto_utils.validate_bar_access(metadata, password)
        if not is_valid:
            raise HTTPException(status_code=403, detail="; ".join(errors))
        
        # Decrypt file
        decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        
        # Verify integrity
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get("file_hash"):
            raise HTTPException(
                status_code=500, 
                detail="File integrity check failed - possible tampering"
            )
        
        # Update view count
        metadata["current_views"] = metadata.get("current_views", 0) + 1
        
        # Check if should destroy
        should_destroy = False
        if metadata.get("max_views", 0) > 0:
            if metadata["current_views"] >= metadata["max_views"]:
                should_destroy = True
        
        # For now, we don't update the original file
        # In a full implementation, you'd re-pack and save it
        
        return {
            "decrypted_data": decrypted_data,
            "metadata": metadata,
            "should_destroy": should_destroy,
            "views_remaining": max(0, metadata.get("max_views", 0) - metadata["current_views"])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")
