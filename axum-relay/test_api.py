#!/usr/bin/env python3
"""
Test script for the Axum Relay API
"""

import requests
import json

# API base URL
BASE_URL = "http://localhost:7777"

def test_generate():
    """Test the generate endpoint"""
    print("=== Testing Generate ===")
    try:
        response = requests.post(f"{BASE_URL}/generate")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Generated account: {data['address']}")
            print(f"   Private key: {data['private_key']}")
            print(f"   Message: {data['message']}")
            return data['address']
        else:
            print(f"❌ Generate failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Generate error: {e}")
        return None

def test_addresses():
    """Test the addresses endpoint"""
    print("\n=== Testing Addresses ===")
    try:
        response = requests.get(f"{BASE_URL}/addresses")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {data['count']} addresses:")
            for addr in data['addresses']:
                print(f"   - {addr}")
            return data['addresses']
        else:
            print(f"❌ Addresses failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Addresses error: {e}")
        return []

def test_sign(address, message="Hello from API test!"):
    """Test the sign endpoint"""
    print(f"\n=== Testing Sign with address {address} ===")
    try:
        payload = {
            "address": address,
            "message": message
        }
        response = requests.post(f"{BASE_URL}/sign", json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Signed message successfully")
            print(f"   Signature: {data['signature']}")
            print(f"   Message: {data['message']}")
            print(f"   Address: {data['address']}")
            return data['signature']
        else:
            print(f"❌ Sign failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Sign error: {e}")
        return None

def main():
    print("🚀 Testing Axum Relay API")
    print(f"   Base URL: {BASE_URL}")
    
    # Test generate
    address = test_generate()
    
    # Test addresses
    addresses = test_addresses()
    
    # Test sign if we have an address
    if address:
        test_sign(address)
    elif addresses:
        test_sign(addresses[0])
    else:
        print("\n⚠️  No addresses available for signing test")
    
    print("\n✨ API test completed!")

if __name__ == "__main__":
    main() 