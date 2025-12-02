"""
OTP (One-Time Password) Service for Two-Factor Authentication
Supports email-based OTP verification
"""
import os
import random
import string
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hashlib

# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 3

# Email Configuration (from environment variables)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "")
FROM_NAME = os.getenv("FROM_NAME", "BAR Web - Secure File Sharing")

# Configure Brevo API
if BREVO_API_KEY:
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = BREVO_API_KEY
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
else:
    api_instance = None


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
    
    def clear_verification(self, token: str) -> None:
        """Clear OTP verification for a token (after successful file access)"""
        if token in self.otp_storage:
            del self.otp_storage[token]
            print(f"🔒 OTP verification cleared for token {token[:8]}... (requires new OTP for next access)")
    
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
        Send OTP code via email using Brevo
        Returns: (success, error_message)
        """
        # Check if Brevo is configured
        if not BREVO_API_KEY or not FROM_EMAIL:
            error_msg = "Email service not configured. Set BREVO_API_KEY and FROM_EMAIL environment variables."
            print(f"⚠️ {error_msg}")
            print(f"BREVO_API_KEY: {'SET' if BREVO_API_KEY else 'NOT SET'}")
            print(f"FROM_EMAIL: {'SET' if FROM_EMAIL else 'NOT SET'}")
            return False, error_msg
        
        if not api_instance:
            error_msg = "Brevo API not initialized"
            print(f"⚠️ {error_msg}")
            return False, error_msg
        
        try:
            
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
            
            # Send email using Brevo
            print(f"📧 Attempting to send OTP email to {email} via Brevo...")
            
            # Create email using Brevo API
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": email}],
                sender={"name": FROM_NAME, "email": FROM_EMAIL},
                subject=f"Your OTP Code - {otp_code}",
                html_content=html_body
            )
            
            # Send the email
            api_response = api_instance.send_transac_email(send_smtp_email)
            
            print(f"✅ OTP email sent successfully to {email}")
            print(f"Brevo Message ID: {api_response.message_id}")
            return True, ""
            
        except ApiException as e:
            error_msg = f"Brevo API error: {e.status} - {e.reason}"
            print(f"❌ {error_msg}")
            print(f"Response body: {e.body}")
            return False, error_msg
        except Exception as e:
            import traceback
            error_msg = f"Failed to send email: {str(e)}"
            print(f"❌ {error_msg}")
            print(f"Full traceback:\n{traceback.format_exc()}")
            return False, error_msg


# Global OTP service instance
otp_service = OTPService()


def get_otp_service() -> OTPService:
    """Get the global OTP service instance"""
    return otp_service
