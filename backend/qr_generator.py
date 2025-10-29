"""
Custom QR Code Generator with Logo and Theme
Generates themed QR codes with embedded BAR logo
"""
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer, CircleModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image, ImageDraw, ImageFilter
import os
from io import BytesIO
import base64


def generate_themed_qr(data: str, logo_path: str = None) -> str:
    """
    Generate a themed QR code with embedded logo
    
    Args:
        data: The data to encode (URL, text, etc.)
        logo_path: Path to logo image to embed in center
        
    Returns:
        Base64 encoded QR code image
    """
    # Create QR code instance optimized for scanning
    qr = qrcode.QRCode(
        version=1,  # Auto-adjust size
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction (30%)
        box_size=15,  # Larger boxes for better scanning
        border=6,  # Larger border for better detection
    )
    
    qr.add_data(data)
    qr.make(fit=True)
    
    # High contrast colors for better scanning
    # Use black instead of gold for maximum scanability
    dark_color = (0, 0, 0)       # Pure black for maximum contrast
    white_color = (255, 255, 255)  # Pure white background
    
    # Create QR code image optimized for scanning
    # Square modules (not rounded) scan better than styled ones
    img = qr.make_image(
        fill_color=dark_color,
        back_color=white_color
    )
    
    # Convert to PIL Image for further processing
    img = img.convert('RGB')
    
    # Add logo in center if provided
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path)
            
            # Calculate logo size (smaller for better scanning - 15% instead of 20%)
            qr_width, qr_height = img.size
            logo_size = min(qr_width, qr_height) // 7
            
            # Resize logo while maintaining aspect ratio
            logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
            
            # Create a white background circle for logo
            logo_bg = Image.new('RGB', (logo_size + 20, logo_size + 20), 'white')
            mask = Image.new('L', (logo_size + 20, logo_size + 20), 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, logo_size + 20, logo_size + 20), fill=255)
            
            # Add subtle shadow effect
            logo_bg = logo_bg.filter(ImageFilter.GaussianBlur(2))
            
            # Calculate center position
            logo_pos_x = (qr_width - logo_size - 20) // 2
            logo_pos_y = (qr_height - logo_size - 20) // 2
            
            # Paste background circle
            img.paste(logo_bg, (logo_pos_x, logo_pos_y), mask)
            
            # Paste logo on top
            logo_x = (qr_width - logo.width) // 2
            logo_y = (qr_height - logo.height) // 2
            
            # Handle transparency
            if logo.mode == 'RGBA':
                img.paste(logo, (logo_x, logo_y), logo)
            else:
                img.paste(logo, (logo_x, logo_y))
                
        except Exception as e:
            print(f"Failed to add logo to QR code: {e}")
    
    # Add clean white border for better scanning
    border_size = 30  # Larger border for better detection
    bordered_img = Image.new('RGB', 
                             (img.width + border_size * 2, img.height + border_size * 2),
                             (255, 255, 255))  # Pure white border
    
    # Paste QR code in center
    bordered_img.paste(img, (border_size, border_size))
    
    # Convert to base64
    buffered = BytesIO()
    bordered_img.save(buffered, format="PNG", optimize=True)
    qr_base64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()
    
    return qr_base64


def generate_simple_qr(data: str) -> str:
    """
    Generate a simple themed QR code without logo (fallback)
    
    Args:
        data: The data to encode
        
    Returns:
        Base64 encoded QR code image
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # Higher error correction
        box_size=15,  # Larger boxes
        border=6,  # Larger border
    )
    
    qr.add_data(data)
    qr.make(fit=True)
    
    # Create simple QR with high contrast (black on white)
    img = qr.make_image(fill_color='black', back_color='white')
    
    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()
    
    return qr_base64
