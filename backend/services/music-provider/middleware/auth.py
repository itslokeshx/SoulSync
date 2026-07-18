"""
Internal service token validation middleware.
Used to verify that requests come from the API gateway.
"""
import os
from fastapi import Request, HTTPException


async def verify_service_token(request: Request) -> None:
    """
    Validate the internal service token from the X-Service-Token header.
    Skip validation if SERVICE_TOKEN is not configured (development mode).
    """
    expected_token = os.getenv("SERVICE_TOKEN")
    if not expected_token:
        return  # No token configured — allow all requests (dev mode)

    token = request.headers.get("X-Service-Token")
    if token != expected_token:
        raise HTTPException(status_code=403, detail="Invalid service token")
