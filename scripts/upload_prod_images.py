import os
import requests
import json

BASE_URL = "https://trustedmarketplace-hyr0.onrender.com"

# 1. Login as seller
login_payload = {
    "email": "artisan.seller@trustedmarketplace.local",
    "password": "SellerDemo123!"
}

print(f"Logging in to {BASE_URL}...")
resp = requests.post(f"{BASE_URL}/api/v1/auth/login", json=login_payload)
if resp.status_code != 200:
    print(f"Login failed: {resp.status_code} - {resp.text}")
    exit(1)

auth_data = resp.json()
token = auth_data["accessToken"]
headers = {
    "Authorization": f"Bearer {token}"
}
print("Login successful! Token acquired.")

# 2. Upload Lotus Silk Scarf to Product 3
prod3_id = "c5c39650-c1b3-4690-af11-83ead537e7f7"
scarf_path = os.path.join("src", "TrustedMarketplace.Infrastructure", "Assets", "SeedImages", "inle-lotus-silk-scarf.jpg")
print(f"Uploading {scarf_path} to Product 3 ({prod3_id})...")
with open(scarf_path, "rb") as f:
    files = {"file": ("inle-lotus-silk-scarf.jpg", f, "image/jpeg")}
    r = requests.post(f"{BASE_URL}/api/v1/seller/products/{prod3_id}/images", headers=headers, files=files)
    print(f"Product 3 Upload Status: {r.status_code}")
    print(f"Response: {r.text}")
    prod3_img = r.json()

# 3. Upload Bagan Lacquerware Bowl to Product 1
prod1_id = "619550b6-4b20-4d91-a7f4-3c74d3cb160b"
bowl_path = os.path.join("src", "TrustedMarketplace.Infrastructure", "Assets", "SeedImages", "bagan-lacquerware-bowl.jpg")
print(f"Uploading {bowl_path} to Product 1 ({prod1_id})...")
with open(bowl_path, "rb") as f:
    files = {"file": ("bagan-lacquerware-bowl.jpg", f, "image/jpeg")}
    r = requests.post(f"{BASE_URL}/api/v1/seller/products/{prod1_id}/images", headers=headers, files=files)
    print(f"Product 1 Upload Status: {r.status_code}")
    print(f"Response: {r.text}")
    prod1_new_img = r.json()

# 4. Set newly uploaded image as primary on Product 1
new_img_id = prod1_new_img["id"]
print(f"Setting image {new_img_id} as primary on Product 1...")
r = requests.put(f"{BASE_URL}/api/v1/seller/products/{prod1_id}/images/{new_img_id}/primary", headers=headers)
print(f"Set Primary Status: {r.status_code} - {r.text}")

# 5. Remove the old broken image (3bff3b04-4dec-4c1b-9f9c-14be1aa97712)
old_img_id = "3bff3b04-4dec-4c1b-9f9c-14be1aa97712"
print(f"Deleting broken old image {old_img_id} from Product 1...")
r = requests.delete(f"{BASE_URL}/api/v1/seller/products/{prod1_id}/images/{old_img_id}", headers=headers)
print(f"Delete Old Image Status: {r.status_code}")

# 6. Verify products listing
print("\nFetching public products listing...")
r = requests.get(f"{BASE_URL}/api/v1/products")
print(f"Products Status: {r.status_code}")
items = r.json().get("items", [])
for p in items:
    print(f"\nProduct: {p['title']} ({p['id']})")
    for img in p.get("images", []):
        print(f"  - Image ID: {img['id']}, Primary: {img['isPrimary']}, StorageKey: {img['storageKey']}, URL: {img['url']}")
