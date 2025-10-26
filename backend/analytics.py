"""
Analytics utilities for BAR Web
Handles device detection and geolocation
"""
import re
from typing import Optional, Dict
import httpx


def get_device_type(user_agent: str) -> str:
    """Detect device type from user agent string"""
    if not user_agent:
        return "Unknown"
    
    user_agent_lower = user_agent.lower()
    
    # Mobile devices
    if any(keyword in user_agent_lower for keyword in ['iphone', 'android', 'mobile', 'phone']):
        return "Mobile"
    
    # Tablets
    if any(keyword in user_agent_lower for keyword in ['ipad', 'tablet']):
        return "Tablet"
    
    # Desktop
    if any(keyword in user_agent_lower for keyword in ['windows', 'mac', 'linux', 'x11']):
        return "Desktop"
    
    # Bots
    if any(keyword in user_agent_lower for keyword in ['bot', 'crawler', 'spider']):
        return "Bot"
    
    return "Unknown"


async def get_geolocation(ip_address: str) -> Optional[Dict[str, str]]:
    """
    Get geolocation data from IP address using ipapi.co (free tier)
    Returns dict with country and city, or None if failed
    """
    if not ip_address or ip_address == "127.0.0.1" or ip_address.startswith("192.168."):
        return {"country": "Local", "city": "Localhost"}
    
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"https://ipapi.co/{ip_address}/json/")
            if response.status_code == 200:
                data = response.json()
                return {
                    "country": data.get("country_name", "Unknown"),
                    "city": data.get("city", "Unknown")
                }
    except Exception as e:
        print(f"⚠️ Geolocation lookup failed for {ip_address}: {e}")
    
    return {"country": "Unknown", "city": "Unknown"}


def get_client_ip(request) -> str:
    """Extract client IP from request headers (handles proxies)"""
    # Check common proxy headers first
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs, take the first (client)
        return forwarded.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct client IP
    if request.client and request.client.host:
        return request.client.host
    
    return "Unknown"
