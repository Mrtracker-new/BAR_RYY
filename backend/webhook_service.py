"""
🔔 Webhook Service - Send notifications when stuff happens!

This module handles sending webhook notifications to external services
like Discord, Slack, or custom endpoints when important events occur.

Events we notify about:
- 🚨 Tamper alerts (file integrity check failed)
- 🔥 File destruction (view limit reached)
- 👁️ File accessed (optional monitoring)
- ❌ Access denied (password failures, etc.)
"""

import httpx
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import json


class WebhookService:
    """Service for sending webhook notifications"""
    
    def __init__(self):
        self.timeout = 10.0  # 10 second timeout for webhook calls
    
    async def send_webhook(
        self,
        webhook_url: str,
        event_type: str,
        data: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """
        Send a webhook notification to the specified URL
        
        Returns:
            (success: bool, error_message: Optional[str])
        """
        if not webhook_url or webhook_url.strip() == "":
            return False, "No webhook URL provided"
        
        try:
            # Prepare the payload
            payload = {
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "service": "BAR Web",
                **data
            }
            
            # Detect webhook type and format accordingly
            print(f"🔍 Webhook URL: {webhook_url[:60]}...")
            is_discord = "discord.com" in webhook_url.lower() or "discordapp.com" in webhook_url.lower()
            print(f"🔍 Is Discord: {is_discord}")
            if is_discord:
                print("✅ Using Discord format")
                payload = self._format_discord_webhook(event_type, data)
            elif "slack.com" in webhook_url.lower():
                print("✅ Using Slack format")
                payload = self._format_slack_webhook(event_type, data)
            else:
                print("ℹ️ Using generic format")
            
            # Send the webhook asynchronously with timeout
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code in [200, 204]:
                    print(f"✅ Webhook sent successfully: {event_type}")
                    return True, None
                else:
                    error_msg = f"Webhook returned status {response.status_code}"
                    print(f"⚠️ {error_msg}")
                    print(f"Response body: {response.text}")
                    print(f"Payload sent: {json.dumps(payload, indent=2)}")
                    return False, error_msg
        
        except asyncio.TimeoutError:
            error_msg = "Webhook request timed out"
            print(f"⏱️ {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"Webhook failed: {str(e)}"
            print(f"❌ {error_msg}")
            return False, error_msg
    
    def _format_discord_webhook(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format payload for Discord webhooks"""
        # Choose color and emoji based on event type
        color_map = {
            "tamper_alert": 0xFF0000,      # Red
            "file_destroyed": 0xFF6600,    # Orange
            "file_accessed": 0x00FF00,     # Green
            "access_denied": 0xFFFF00      # Yellow
        }
        
        emoji_map = {
            "tamper_alert": "🚨",
            "file_destroyed": "🔥",
            "file_accessed": "👁️",
            "access_denied": "🚫"
        }
        
        color = color_map.get(event_type, 0x808080)
        emoji = emoji_map.get(event_type, "📢")
        
        # Build embed fields
        fields = []
        for key, value in data.items():
            if key not in ["timestamp"]:  # Skip timestamp as it's in footer
                fields.append({
                    "name": key.replace("_", " ").title(),
                    "value": str(value),
                    "inline": True
                })
        
        return {
            "embeds": [{
                "title": f"{emoji} BAR Web Alert: {event_type.replace('_', ' ').title()}",
                "color": color,
                "fields": fields,
                "footer": {
                    "text": "BAR Web Security Alert System"
                },
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }]
        }
    
    def _format_slack_webhook(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format payload for Slack webhooks"""
        emoji_map = {
            "tamper_alert": ":rotating_light:",
            "file_destroyed": ":fire:",
            "file_accessed": ":eyes:",
            "access_denied": ":no_entry:"
        }
        
        emoji = emoji_map.get(event_type, ":bell:")
        
        # Build text content
        text_lines = [f"*{emoji} BAR Web Alert: {event_type.replace('_', ' ').title()}*"]
        for key, value in data.items():
            text_lines.append(f"• *{key.replace('_', ' ').title()}:* {value}")
        
        return {
            "text": "\n".join(text_lines)
        }
    
    async def send_tamper_alert(
        self,
        webhook_url: str,
        filename: str,
        token: Optional[str] = None,
        original_hash: Optional[str] = None,
        computed_hash: Optional[str] = None
    ):
        """Send a tamper alert webhook"""
        data = {
            "filename": filename,
            "message": "File integrity check failed - possible tampering detected",
            "severity": "HIGH"
        }
        
        if token:
            data["file_token"] = token[:16] + "..."  # Partial token for privacy
        if original_hash:
            data["original_hash"] = original_hash[:16] + "..."
        if computed_hash:
            data["computed_hash"] = computed_hash[:16] + "..."
        
        return await self.send_webhook(webhook_url, "tamper_alert", data)
    
    async def send_destruction_alert(
        self,
        webhook_url: str,
        filename: str,
        reason: str,
        views_used: Optional[int] = None,
        max_views: Optional[int] = None
    ):
        """Send a file destruction webhook"""
        data = {
            "filename": filename,
            "reason": reason,
            "message": "File has been permanently destroyed"
        }
        
        if views_used is not None and max_views is not None:
            data["views"] = f"{views_used}/{max_views}"
        
        return await self.send_webhook(webhook_url, "file_destroyed", data)
    
    async def send_access_alert(
        self,
        webhook_url: str,
        filename: str,
        ip_address: str,
        views_remaining: Optional[int] = None
    ):
        """Send a file access notification webhook"""
        data = {
            "filename": filename,
            "ip_address": ip_address[:10] + "...",  # Partial IP for privacy
            "message": "File accessed successfully"
        }
        
        if views_remaining is not None:
            data["views_remaining"] = views_remaining
        
        return await self.send_webhook(webhook_url, "file_accessed", data)
    
    async def send_access_denied_alert(
        self,
        webhook_url: str,
        filename: str,
        reason: str,
        ip_address: str
    ):
        """Send an access denied webhook"""
        data = {
            "filename": filename,
            "reason": reason,
            "ip_address": ip_address[:10] + "...",  # Partial IP for privacy
            "message": "Access attempt denied"
        }
        
        return await self.send_webhook(webhook_url, "access_denied", data)


# Global webhook service instance
_webhook_service = None


def get_webhook_service() -> WebhookService:
    """Get the global webhook service instance"""
    global _webhook_service
    if _webhook_service is None:
        _webhook_service = WebhookService()
    return _webhook_service
