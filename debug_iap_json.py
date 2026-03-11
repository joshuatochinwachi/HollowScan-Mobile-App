import json
import os
import sys

def debug_json():
    # Attempt to read the variable exactly as it would be in the environment
    json_str = os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "")
    
    print(f"--- JSON Debugging ---")
    print(f"Length: {len(json_str)}")
    
    if not json_str:
        print("ERROR: Variable is empty or not found.")
        return

    # Check for common "invisible" issues
    print(f"Starts with: '{json_str[:10]}...' (hex: {json_str[:1].encode().hex()})")
    print(f"Ends with: '...{json_str[-10:]}' (hex: {json_str[-1:].encode().hex()})")
    
    try:
        data = json.loads(json_str)
        print("SUCCESS: JSON is valid.")
        print(f"Keys found: {list(data.keys())}")
    except json.JSONDecodeError as e:
        print(f"FAILURE: Invalid JSON format.")
        print(f"Error Message: {e.msg}")
        print(f"At Line: {e.lineno}, Column: {e.colno}, Char: {e.pos}")
        
        # Show a snippet around the error
        start = max(0, e.pos - 20)
        end = min(len(json_str), e.pos + 20)
        print(f"Snippet near error: ...{json_str[start:end]}...")
        print(" " * (e.pos - start + 18) + "^")

if __name__ == "__main__":
    debug_json()
