from eth_account import Account
import secrets
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# File for storing encrypted keys
KEYSTORE_PATH = "keystore.json"

# Secret for encrypting and decrypting keys - simulates the root of trust for the enclave
SECRET = os.getenv("ENCLAVE_SECRET")

def generate_ethereum_account():
    """Generate a new Ethereum account (private key and address)"""
    private_key = "0x" + secrets.token_hex(32)
    account = Account.from_key(private_key)
    return {
        "address": account.address,
        "private_key": private_key
    }

def encrypt_key(private_key, secret):
    """Encrypt private key with a secret"""
    account = Account.from_key(private_key)
    encrypted = Account.encrypt(private_key, secret)
    return encrypted

def decrypt_key(encrypted_key, secret):
    """Decrypt an encrypted key"""
    try:
        private_key = Account.decrypt(encrypted_key, secret)
        return "0x" + private_key.hex()
    except ValueError:
        return None

def store_key(address, encrypted_key):
    """Store an encrypted key in the local keystore"""
    if os.path.exists(KEYSTORE_PATH):
        with open(KEYSTORE_PATH, "r") as f:
            keystore = json.load(f)
    else:
        keystore = {}
    
    keystore[address] = encrypted_key
    
    with open(KEYSTORE_PATH, "w") as f:
        json.dump(keystore, f, indent=2)

def get_key(address):
    """Retrieve an encrypted key from the keystore"""
    if not os.path.exists(KEYSTORE_PATH):
        return None
    
    with open(KEYSTORE_PATH, "r") as f:
        keystore = json.load(f)
    
    return keystore.get(address)

def list_addresses():
    """List all addresses in the keystore"""
    if not os.path.exists(KEYSTORE_PATH):
        return []
    
    with open(KEYSTORE_PATH, "r") as f:
        keystore = json.load(f)
    
    return list(keystore.keys())

if __name__ == "__main__":
    account = generate_ethereum_account()
    encrypted_key = encrypt_key(account["private_key"], SECRET)
    store_key(account["address"], encrypted_key)
    print(f"Stored key for address: {account['address']}")

    # Load the key from the keystore
    loaded_key = get_key(account["address"])
    print(f"Loaded key: {loaded_key}")

    # Decrypt the key
    decrypted_key = decrypt_key(loaded_key, SECRET)
    print(f"Decrypted key: {decrypted_key}")

    assert decrypted_key == account["private_key"]

    
