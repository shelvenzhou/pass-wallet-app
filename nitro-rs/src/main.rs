use serde::{Deserialize, Serialize};
use std::collections::HashMap;
// use std::fs;
// use std::path::Path;
use anyhow::{Result, anyhow};
use k256::{SecretKey, PublicKey, ecdsa::{SigningKey, VerifyingKey, Signature, RecoveryId}};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use rand::RngCore;
use sha3::{Keccak256, Digest};
use aes_gcm::{Aes256Gcm, Key, Nonce, aead::Aead, KeyInit};
use hex;

// const KEYSTORE_PATH: &str = "keystore.json";

#[derive(Serialize, Deserialize, Clone)]
struct EncryptedKey {
    ciphertext: String,
    nonce: String,
}

#[derive(Serialize, Deserialize)]
struct EthereumAccount {
    address: String,
    private_key: String,
}

struct EnclaveKMS {
    secret: [u8; 32],
    keystore: HashMap<String, EncryptedKey>,
}

impl EnclaveKMS {
    fn new(secret: &str) -> Result<Self> {
        let mut secret_bytes = [0u8; 32];
        let secret_hash = Keccak256::digest(secret.as_bytes());
        secret_bytes.copy_from_slice(&secret_hash);
        
        Ok(EnclaveKMS {
            secret: secret_bytes,
            keystore: HashMap::new(),
        })
    }

    fn generate_ethereum_account(&self) -> Result<EthereumAccount> {
        let mut rng = rand::thread_rng();
        let mut private_key_bytes = [0u8; 32];
        rng.fill_bytes(&mut private_key_bytes);
        
        let secret_key = SecretKey::from_bytes(&private_key_bytes.into())?;
        let public_key = secret_key.public_key();
        
        let address = self.public_key_to_address(&public_key);
        let private_key = format!("0x{}", hex::encode(private_key_bytes));
        
        Ok(EthereumAccount {
            address,
            private_key,
        })
    }

    fn public_key_to_address(&self, public_key: &PublicKey) -> String {
        let public_key_bytes = public_key.to_encoded_point(false);
        let public_key_slice = public_key_bytes.as_bytes();
        // Skip the first byte (0x04) for uncompressed format
        let hash = Keccak256::digest(&public_key_slice[1..]);
        // Take the last 20 bytes and format as hex with 0x prefix
        format!("0x{}", hex::encode(&hash[12..]))
    }

    fn encrypt_key(&self, private_key: &str) -> Result<EncryptedKey> {
        let key = Key::<Aes256Gcm>::from_slice(&self.secret);
        let cipher = Aes256Gcm::new(key);
        
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let private_key_clean = private_key.strip_prefix("0x").unwrap_or(private_key);
        let private_key_bytes = hex::decode(private_key_clean)?;
        
        let ciphertext = cipher.encrypt(nonce, private_key_bytes.as_ref())
            .map_err(|e| anyhow!("Encryption failed: {}", e))?;
        
        Ok(EncryptedKey {
            ciphertext: hex::encode(ciphertext),
            nonce: hex::encode(nonce_bytes),
        })
    }

    fn decrypt_key(&self, encrypted_key: &EncryptedKey) -> Result<String> {
        let key = Key::<Aes256Gcm>::from_slice(&self.secret);
        let cipher = Aes256Gcm::new(key);
        
        let nonce_bytes = hex::decode(&encrypted_key.nonce)?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = hex::decode(&encrypted_key.ciphertext)?;
        
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| anyhow!("Decryption failed: {}", e))?;
        
        Ok(format!("0x{}", hex::encode(plaintext)))
    }

    fn store_key(&mut self, address: &str, encrypted_key: &EncryptedKey) -> Result<()> {
        self.keystore.insert(address.to_string(), encrypted_key.clone());
        Ok(())
    }

    fn get_key(&self, address: &str) -> Result<Option<EncryptedKey>> {
        Ok(self.keystore.get(address).cloned())
    }

    fn list_addresses(&self) -> Result<Vec<String>> {
        Ok(self.keystore.keys().cloned().collect())
    }

    fn sign_message(&self, message: &str, address: &str) -> Result<Option<String>> {
        let encrypted_key = match self.get_key(address)? {
            Some(key) => key,
            None => return Ok(None),
        };
        
        let private_key_hex = match self.decrypt_key(&encrypted_key) {
            Ok(key) => key,
            Err(_) => return Ok(None),
        };
        
        let private_key_clean = private_key_hex.strip_prefix("0x").unwrap_or(&private_key_hex);
        let private_key_bytes = hex::decode(private_key_clean)?;
        
        // Convert Vec<u8> to [u8; 32] array
        let private_key_array: [u8; 32] = private_key_bytes.try_into()
            .map_err(|_| anyhow!("Invalid private key length"))?;
        
        let secret_key = SecretKey::from_bytes(&private_key_array.into())?;
        let signing_key = SigningKey::from(secret_key);
        
        // Create EIP-191 message hash
        let message_hash = self.hash_message(message);
        
        let (signature, recovery_id) = signing_key.sign_prehash_recoverable(&message_hash)?;
        
        // Convert to Ethereum signature format (r, s, v)
        let signature_bytes = signature.to_bytes();
        let mut eth_signature = [0u8; 65];
        eth_signature[..64].copy_from_slice(&signature_bytes);
        eth_signature[64] = recovery_id.to_byte() + 27; // Ethereum v value
        
        Ok(Some(format!("0x{}", hex::encode(eth_signature))))
    }

    fn hash_message(&self, message: &str) -> [u8; 32] {
        let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
        let mut hasher = Keccak256::new();
        hasher.update(prefix.as_bytes());
        hasher.update(message.as_bytes());
        hasher.finalize().into()
    }

    fn verify_message(&self, message: &str, signature: &str, address: &str) -> Result<bool> {
        let signature_clean = signature.strip_prefix("0x").unwrap_or(signature);
        let signature_bytes = hex::decode(signature_clean)?;
        
        if signature_bytes.len() != 65 {
            return Ok(false);
        }
        
        let recovery_id = RecoveryId::from_byte(signature_bytes[64] - 27)
            .ok_or_else(|| anyhow!("Invalid recovery ID"))?;
        
        // Convert &[u8] to [u8; 64] array
        let signature_array: [u8; 64] = signature_bytes[..64].try_into()
            .map_err(|_| anyhow!("Invalid signature length"))?;
        
        let signature = Signature::from_bytes(&signature_array.into())?;
        
        let message_hash = self.hash_message(message);
        
        let recovered_key = VerifyingKey::recover_from_prehash(&message_hash, &signature, recovery_id)?;
        let recovered_pubkey = PublicKey::from(&recovered_key);
        let recovered_address = self.public_key_to_address(&recovered_pubkey);
        
        Ok(recovered_address.to_lowercase() == address.to_lowercase())
    }
}

fn main() -> Result<()> {
    // Get secret from environment or use default for testing
    let secret = std::env::var("ENCLAVE_SECRET").unwrap_or_else(|_| "test_secret".to_string());
    let mut kms = EnclaveKMS::new(&secret)?;
    
    // Main loop: every 5 seconds
    loop {
        // Generate a new account
        println!("================================================");
        let account = kms.generate_ethereum_account()?;
        println!("Generated Ethereum Address: {}", account.address);
        println!("Private Key: {}", account.private_key);
        
        // Encrypt and store the key
        let encrypted_key = kms.encrypt_key(&account.private_key)?;
        kms.store_key(&account.address, &encrypted_key)?;
        
        // Sign a message
        let message = "Hello, world!";
        let signature = kms.sign_message(message, &account.address)?.unwrap();
        println!("Message: {}", message);
        println!("Signature: {}", signature);

        // Verify the signature
        let verified = kms.verify_message(message, &signature, &account.address)?;
        println!("Verified: {}", verified);
        
        // Print the hashmap contents
        // println!("\nKeystore HashMap contents:");
        // for (address, encrypted_key) in &kms.keystore {
        //     println!("Address: {}", address);
        //     println!("  Ciphertext: {}", encrypted_key.ciphertext);
        //         println!("  Nonce: {}", encrypted_key.nonce);
        // }
        // List all addresses
        let addresses = kms.list_addresses()?;
        println!("Stored addresses: {:?}", addresses);
        println!("Length: {}", addresses.len());
        
        std::thread::sleep(std::time::Duration::from_secs(5));
    }
    
    // Ok(())
}
