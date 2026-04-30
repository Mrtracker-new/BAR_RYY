"""
Upload-based BAR file decryption handler.

Decrypts a .bar file that was uploaded directly to the endpoint.  This path
is currently not wired into any live route but is kept for future use.

Access validation is delegated to the authoritative storage-layer validators:
  - client_storage.validate_client_access  for storage_mode='client' files
  - server_storage.validate_server_access  for storage_mode='server' files

The routing is determined by the 'storage_mode' field written by
create_client_metadata() / create_server_metadata() at seal time.
"""
from fastapi import UploadFile, HTTPException
from utils import crypto_utils
from storage import client_storage
from storage import server_storage


async def decrypt_uploaded_bar(file: UploadFile, password: str = None):
    """
    Decrypt a .bar file that was uploaded
    Returns decrypted data and metadata
    """
    try:
        # Read uploaded .bar file
        bar_data = await file.read()
        
        # Unpack BAR file with password for password-derived encryption
        encrypted_data, metadata, key, _salt = crypto_utils.unpack_bar_file(bar_data, password=password)
        
        # Validate access using the authoritative storage-layer validator.
        #
        # The storage_mode field is stamped into every BAR file's plaintext
        # metadata by create_client_metadata() / create_server_metadata() at
        # seal time.  It is the single source of truth for which rule-set
        # governs this file:
        #
        #   'client' → validate_client_access  (expiry + password presence)
        #   'server' → validate_server_access  (expiry + view limits + password)
        #
        # Defaulting to 'server' for unrecognised / missing values ensures that
        # the stricter rule-set applies rather than silently downgrading access
        # control on legacy or tampered files.
        storage_mode = metadata.get("storage_mode", "server")
        if storage_mode == "client":
            is_valid, errors = client_storage.validate_client_access(metadata, password)
        else:
            is_valid, errors = server_storage.validate_server_access(metadata, password)
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
        
    except HTTPException:
        # Let FastAPI handle its own exceptions unchanged.
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")
