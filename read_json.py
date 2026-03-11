import json
import os

path = r"C:\Users\Jo$h\Desktop\Visual Studio Code\HollowScan-Mobile-App\glossy-metric-455008-p1-55180b5daaf8.json"
if os.path.exists(path):
    with open(path, 'r') as f:
        content = f.read()
        print("--- FILE BEGIN ---")
        print(content)
        print("--- FILE END ---")
else:
    print("File not found.")
