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
    # Create QR code instance with higher error correction for logo
    qr = qrcode.QRCode(
        version=1,  # Auto-adjust size
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # High error correction (30%)
        box_size=10,
        border=4,
    )
    
    qr.add_data(data)
    qr.make(fit=True)
    
    # Gold/brown theme colors matching BAR Web
    gold_color = (212, 175, 55)  # Gold #D4AF37
    dark_color = (30, 30, 30)    # Dark background
    
    # Create QR code image with styled appearance
    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),  # Rounded squares for modern look
        color_mask=SolidFillColorMask(
            back_color=(255, 255, 255),  # White background
            front_color=gold_color       # Gold modules
        )
    )
    
    # Convert to PIL Image for further processing
    img = img.convert('RGB')
    
    # Add logo in center if provided
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path)
            
            # Calculate logo size (about 20% of QR code)
            qr_width, qr_height = img.size
            logo_size = min(qr_width, qr_height) // 5
            
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
    
    # Add decorative border with gold theme
    border_size = 20
    bordered_img = Image.new('RGB', 
                             (img.width + border_size * 2, img.height + border_size * 2),
                             (20, 20, 20))  # Dark border
    
    # Draw gold inner border
    draw = ImageDraw.Draw(bordered_img)
    draw.rectangle(
        [(border_size - 5, border_size - 5), 
         (bordered_img.width - border_size + 5, bordered_img.height - border_size + 5)],
        outline=gold_color,
        width=3
    )
    
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
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    
    qr.add_data(data)
    qr.make(fit=True)
    
    # Create simple QR with gold theme
    img = qr.make_image(fill_color=(212, 175, 55), back_color='white')
    
    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()
    
    return qr_base64
