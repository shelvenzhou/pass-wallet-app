from eth_account import Account
import secrets
import json
import os
from dotenv import load_dotenv
from eth_account.messages import encode_defunct

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

def sign_message(message: str, address: str) -> str:
    """Sign a message using the private key associated with the given address
    
    Args:
        message: The message to sign
        address: The Ethereum address whose private key will be used for signing
        
    Returns:
        The signature as a hex string, or None if the key cannot be found/decrypted
    """
    # Get the encrypted key from keystore
    encrypted_key = get_key(address)
    if not encrypted_key:
        return None
    
    # Decrypt the private key
    private_key = decrypt_key(encrypted_key, SECRET)
    if not private_key:
        return None
    
    # Create account and sign message
    account = Account.from_key(private_key)
    # Create an EIP-191 encoded message
    message_to_sign = encode_defunct(text=message)
    signed_message = account.sign_message(message_to_sign)
    
    return signed_message.signature.hex()

def verify_message(message: str, signature: str, address: str) -> bool:
    """Verify a message signature
    
    Args:
        message: The original message
        signature: The signature to verify (hex string)
        address: The Ethereum address that should have signed the message
        
    Returns:
        True if the signature is valid, False otherwise
    """
    # Create an EIP-191 encoded message
    message_to_verify = encode_defunct(text=message)
    # Convert hex signature to bytes
    signature_bytes = bytes.fromhex(signature.replace('0x', ''))
    # Verify the signature
    verified = Account.recover_message(message_to_verify, signature=signature_bytes)
    return verified.lower() == address.lower()


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

    # Sign a message
    message = "Hello, world!"
    signature = sign_message(message, account["address"])
    print(f"Signed message: {signature}")

    # Verify the signature
    verified = verify_message(message, signature, account["address"])
    print(f"Verified: {verified}")
    
