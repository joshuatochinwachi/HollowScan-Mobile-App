#!/usr/bin/env python3
"""
google_play_utils.py
Utilities for verifying Google Play subscriptions on the backend.
Requires: google-api-python-client, google-auth
"""

import os
import json
from datetime import datetime, timezone, timedelta
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Environment Variable for Service Account JSON
GOOGLE_PAY_SECRET_ENV = "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
PACKAGE_NAME = "com.kttylabs.app" # As seen in your Play Console screenshot

def get_google_play_service():
    """Authenticates and returns the Google Play Developer API service."""
    service_account_info = os.getenv(GOOGLE_PAY_SECRET_ENV)
    
    if not service_account_info:
        print(f"[GOOGLE] Error: Environment variable {GOOGLE_PAY_SECRET_ENV} not set.")
        return None
        
    try:
        # Load JSON from string
        info = json.loads(service_account_info)
        
        # Aggressive cleaning for the private key
        if "private_key" in info and isinstance(info["private_key"], str):
            key = info["private_key"].strip()
            # Handle literal backslash-n sequences
            key = key.replace("\\n", "\n")
            
            # REMOVE all whitespace/newlines from the actual Base64 body
            # but keep the headers/footers
            header = "-----BEGIN PRIVATE KEY-----"
            footer = "-----END PRIVATE KEY-----"
            
            if header in key and footer in key:
                # Extract the body, remove all spaces/newlines, then re-wrap at 64 chars
                body = key.replace(header, "").replace(footer, "").replace("\n", "").replace(" ", "").replace("\r", "").strip()
                # Re-wrap the body every 64 characters
                wrapped_body = "\n".join([body[i:i+64] for i in range(0, len(body), 64)])
                # Reconstruct the perfect PEM key
                key = f"{header}\n{wrapped_body}\n{footer}\n"
            
            info["private_key"] = key
            
            # Diagnostics: Count real newlines to confirm wrapping worked
            nl_count = key.count("\n")
            print(f"[GOOGLE] Key Fixed: Length={len(key)}, Newlines={nl_count}, StartsOk={key.startswith(header)}")
            
        scopes = ['https://www.googleapis.com/auth/androidpublisher']
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
        print(f"[GOOGLE] Service Account Email: {info.get('client_email')}")
        return build('androidpublisher', 'v3', credentials=creds)
    except Exception as e:
        print(f"[GOOGLE] Error parsing service account JSON: {e}")
        return None

async def verify_subscription(purchase_token: str, product_id: str):
    """
    Verifies a subscription purchase token with Google Play.
    Returns: (is_valid, expiry_time_iso, reason)
    """
    service = get_google_play_service()
    if not service:
        return False, None, "Service Account configuration error"

    try:
        # product_id is the 'subscriptionId' in Google's API
        request = service.purchases().subscriptions().get(
            packageName=PACKAGE_NAME,
            subscriptionId=product_id,
            token=purchase_token
        )
        response = request.execute()
        
        # Check payment state (1 = Active, 0 = Pending/Pending payment)
        payment_state = response.get('paymentState')
        expiry_time_ms = response.get('expiryTimeMillis')
        
        if payment_state == 1 and expiry_time_ms:
            # Convert ms timestamp to ISO string
            expiry_dt = datetime.fromtimestamp(int(expiry_time_ms) / 1000, tz=timezone.utc)
            return True, expiry_dt.isoformat(), "Success"
        else:
            return False, None, f"Status: {payment_state or 'Unknown'}"
            
    except HttpError as e:
        try:
            error_details = json.loads(e.content.decode('utf-8'))
            print(f"[GOOGLE] Full Error: {json.dumps(error_details, indent=2)}")
            message = error_details.get('error', {}).get('message', 'Unknown API Error')
        except:
            message = str(e)
        print(f"[GOOGLE] Verification failed: {message}")
        return False, None, message
    except Exception as e:
        print(f"[GOOGLE] Unexpected error: {e}")
        return False, None, str(e)
