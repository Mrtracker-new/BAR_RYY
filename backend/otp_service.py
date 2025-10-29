"""
OTP (One-Time Password) Service for Two-Factor Authentication
Supports email-based OTP verification
"""
import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hashlib

# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 3

# Email Configuration (from environment variables)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")  # Your email
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # App password for Gmail
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)
FROM_NAME = os.getenv("FROM_NAME", "BAR Web - Secure File Sharing")


class OTPService:
    """Handles OTP generation, storage, and validation"""
    
    def __init__(self):
        self.otp_storage: Dict[str, Dict[str, Any]] = {}
    
    def generate_otp(self) -> str:
        """Generate a random 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=OTP_LENGTH))
    
    def create_otp_session(self, token: str, email: str) -> str:
        """
        Create an OTP session for a file access token
        Returns: OTP code
        """
        otp_code = self.generate_otp()
        
        # Hash the OTP for storage (security best practice)
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        
        # Store OTP with metadata
        self.otp_storage[token] = {
            'otp_hash': otp_hash,
            'email': email,
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
            'attempts': 0,
            'verified': False
        }
        
        print(f"✅ OTP created for token {token[:8]}... (expires in {OTP_EXPIRY_MINUTES} min)")
        return otp_code
    
    def verify_otp(self, token: str, otp_code: str) -> tuple[bool, str]:
        """
        Verify OTP code for a token
        Returns: (is_valid, error_message)
        """
        # Check if OTP session exists
        if token not in self.otp_storage:
            return False, "OTP session not found. Please request a new OTP."
        
        session = self.otp_storage[token]
        
        # Check if already verified
        if session['verified']:
            return False, "OTP already used. Please request a new OTP."
        
        # Check expiry
        if datetime.now(timezone.utc) > session['expires_at']:
            del self.otp_storage[token]
            return False, "OTP has expired. Please request a new OTP."
        
        # Check max attempts
        if session['attempts'] >= MAX_OTP_ATTEMPTS:
            del self.otp_storage[token]
            return False, f"Maximum OTP attempts ({MAX_OTP_ATTEMPTS}) exceeded. Please request a new OTP."
        
        # Increment attempt counter
        session['attempts'] += 1
        
        # Verify OTP
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        
        if otp_hash == session['otp_hash']:
            session['verified'] = True
            print(f"✅ OTP verified successfully for token {token[:8]}...")
            return True, ""
        else:
            remaining_attempts = MAX_OTP_ATTEMPTS - session['attempts']
            return False, f"Invalid OTP code. {remaining_attempts} attempts remaining."
    
    def is_verified(self, token: str) -> bool:
        """Check if token has been verified with OTP"""
        if token not in self.otp_storage:
            return False
        return self.otp_storage[token].get('verified', False)
    
    def cleanup_expired_otps(self):
        """Remove expired OTP sessions"""
        now = datetime.now(timezone.utc)
        expired_tokens = [
            token for token, session in self.otp_storage.items()
            if now > session['expires_at']
        ]
        
        for token in expired_tokens:
            del self.otp_storage[token]
        
        if expired_tokens:
            print(f"🧹 Cleaned up {len(expired_tokens)} expired OTP sessions")
    
    def send_otp_email(self, email: str, otp_code: str, filename: str) -> tuple[bool, str]:
        """
        Send OTP code via email
        Returns: (success, error_message)
        """
        # Check if SMTP is configured
        if not SMTP_USER or not SMTP_PASSWORD:
            error_msg = "Email service not configured. Set SMTP_USER and SMTP_PASSWORD environment variables."
            print(f"⚠️ {error_msg}")
            print(f"SMTP_USER: {'SET' if SMTP_USER else 'NOT SET'}")
            print(f"SMTP_PASSWORD: {'SET' if SMTP_PASSWORD else 'NOT SET'}")
            print(f"SMTP_HOST: {SMTP_HOST}")
            print(f"SMTP_PORT: {SMTP_PORT}")
            return False, error_msg
        
        try:
            # Create email message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
            msg['To'] = email
            msg['Subject'] = f"Your OTP Code - {otp_code}"
            
            # Create HTML email body
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .otp-code {{ background: #fff; border: 2px dashed #667eea; padding: 20px; 
                                text-align: center; font-size: 32px; font-weight: bold; 
                                letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; 
                               padding: 12px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Two-Factor Authentication</h1>
                    </div>
                    <div class="content">
                        <h2>Access Verification Required</h2>
                        <p>Someone is attempting to access the file: <strong>{filename}</strong></p>
                        <p>Use the following One-Time Password (OTP) to verify access:</p>
                        
                        <div class="otp-code">{otp_code}</div>
                        
                        <div class="warning">
                            <strong>⏰ Important:</strong>
                            <ul>
                                <li>This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong></li>
                                <li>You have <strong>{MAX_OTP_ATTEMPTS} attempts</strong> to enter it correctly</li>
                                <li>Do not share this code with anyone</li>
                            </ul>
                        </div>
                        
                        <p>If you didn't request this access, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>BAR Web - Burn After Reading File Sharing</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text version
            text_body = f"""
            Two-Factor Authentication - BAR Web
            
            Access Verification Required
            
            Someone is attempting to access the file: {filename}
            
            Your One-Time Password (OTP):
            {otp_code}
            
            Important:
            - This code expires in {OTP_EXPIRY_MINUTES} minutes
            - You have {MAX_OTP_ATTEMPTS} attempts to enter it correctly
            - Do not share this code with anyone
            
            If you didn't request this access, you can safely ignore this email.
            
            BAR Web - Burn After Reading File Sharing
            """
            
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            # Send email
            print(f"📧 Attempting to send OTP email to {email}...")
            print(f"SMTP: {SMTP_HOST}:{SMTP_PORT}")
            
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
                print("✅ Connected to SMTP server")
                server.set_debuglevel(1)  # Enable debug output
                server.starttls()
                print("✅ TLS started")
                server.login(SMTP_USER, SMTP_PASSWORD)
                print("✅ Logged in successfully")
                server.send_message(msg)
                print("✅ Message sent")
            
            print(f"📧 OTP email sent successfully to {email}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError:
            error_msg = "Email authentication failed. Check SMTP credentials."
            print(f"❌ {error_msg}")
            return False, error_msg
        except smtplib.SMTPException as e:
            error_msg = f"Failed to send email: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg
        except Exception as e:
            import traceback
            error_msg = f"Unexpected error sending email: {str(e)}"
            print(f"❌ {error_msg}")
            print(f"Full traceback:\n{traceback.format_exc()}")
            return False, error_msg


# Global OTP service instance
otp_service = OTPService()


def get_otp_service() -> OTPService:
    """Get the global OTP service instance"""
    return otp_service
