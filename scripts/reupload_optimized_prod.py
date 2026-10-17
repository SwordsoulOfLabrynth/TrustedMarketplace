import os
import requests

BASE_URL = "https://trustedmarketplace-hyr0.onrender.com"

# 1. Login
resp = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
    "email": "artisan.seller@trustedmarketplace.local",
    "password": "SellerDemo123!"
})
if resp.status_code != 200:
    print(f"Login failed: {resp.status_code}")
    exit(1)

token = resp.json()["accessToken"]
headers = {"Authorization": f"Bearer {token}"}
print("Authenticated as seller.")

# Products & their seed filenames
products = [
    {
        "id": "619550b6-4b20-4d91-a7f4-3c74d3cb160b",
        "file": "bagan-lacquerware-bowl.jpg",
        "title": "Bagan Traditional Lacquerware Bowl"
    },
    {
        "id": "a6cc0cf1-a5ac-485a-81fe-9f53287d3ef9",
        "file": "mandalay-teak-marionette.jpg",
        "title": "Handcrafted Mandalay Teak Marionette Puppet"
    },
    {
        "id": "c5c39650-c1b3-4690-af11-83ead537e7f7",
        "file": "inle-lotus-silk-scarf.jpg",
        "title": "Inle Lake Handwoven Lotus Silk Scarf"
    }
]

seed_dir = os.path.join("src", "TrustedMarketplace.Infrastructure", "Assets", "SeedImages")

for p in products:
    p_id = p["id"]
    filepath = os.path.join(seed_dir, p["file"])
    print(f"\nProcessing {p['title']} ({p_id})...")

    # Get current images
    r = requests.get(f"{BASE_URL}/api/v1/products/{p_id}")
    cur_images = r.json().get("images", [])

    # Upload optimized image
    with open(filepath, "rb") as f:
        files = {"file": (p["file"], f, "image/jpeg")}
        up_r = requests.post(f"{BASE_URL}/api/v1/seller/products/{p_id}/images", headers=headers, files=files)
        print(f"Uploaded new image: {up_r.status_code}")
        new_img = up_r.json()
        new_id = new_img["id"]
        print(f"New Image ID: {new_id}, Key: {new_img['storageKey']}")

    # Set as primary
    prim_r = requests.put(f"{BASE_URL}/api/v1/seller/products/{p_id}/images/{new_id}/primary", headers=headers)
    print(f"Set primary: {prim_r.status_code}")

    # Delete older images
    for old in cur_images:
        old_id = old["id"]
        del_r = requests.delete(f"{BASE_URL}/api/v1/seller/products/{p_id}/images/{old_id}", headers=headers)
        print(f"Deleted old image {old_id}: {del_r.status_code}")

print("\nAll products updated with optimized high-performance photography!")
