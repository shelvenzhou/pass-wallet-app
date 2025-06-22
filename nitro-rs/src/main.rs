use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::io::{Read, Write};
// use std::fs;
// use std::path::Path;
use anyhow::{Result, anyhow};
use k256::{SecretKey, PublicKey, ecdsa::{SigningKey, VerifyingKey, Signature, RecoveryId}};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use rand::RngCore;
use sha3::{Keccak256, Digest};
use aes_gcm::{Aes256Gcm, Key, Nonce, aead::Aead, KeyInit};
use hex;
use vsock::{VsockListener, VsockStream};
use std::thread;

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

#[derive(Clone)]
struct EnclaveKMS {
    secret: [u8; 32],
    keystore: Arc<Mutex<HashMap<String, EncryptedKey>>>,
}

impl EnclaveKMS {
    fn new(secret: &str) -> Result<Self> {
        let mut secret_bytes = [0u8; 32];
        let secret_hash = Keccak256::digest(secret.as_bytes());
        secret_bytes.copy_from_slice(&secret_hash);
        
        Ok(EnclaveKMS {
            secret: secret_bytes,
            keystore: Arc::new(Mutex::new(HashMap::new())),
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
        self.keystore.lock().unwrap().insert(address.to_string(), encrypted_key.clone());
        Ok(())
    }

    fn get_key(&self, address: &str) -> Result<Option<EncryptedKey>> {
        Ok(self.keystore.lock().unwrap().get(address).cloned())
    }

    fn list_addresses(&self) -> Result<Vec<String>> {
        Ok(self.keystore.lock().unwrap().keys().cloned().collect())
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

#[derive(Serialize, Deserialize)]
enum Command {
    Keygen,
    Sign { address: String, message: String },
    List,
}

#[derive(Serialize, Deserialize)]
struct Response {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Get secret from environment or use default for testing
    let secret = std::env::var("ENCLAVE_SECRET").unwrap_or_else(|_| "test_secret".to_string());
    let kms = EnclaveKMS::new(&secret)?;
    let kms_arc = Arc::new(Mutex::new(kms));
    
    // Bind to vsock port 7777
    let listener = VsockListener::bind(&7777)?;
    println!("Enclave KMS listening on vsock port 7777");
    
    loop {
        match listener.accept() {
            Ok((mut stream, addr)) => {
                println!("Accepted connection from {}", addr);
                
                // Handle the connection in a separate thread
                let kms_clone = Arc::clone(&kms_arc);
                thread::spawn(move || {
                    if let Err(e) = handle_connection(&mut stream, kms_clone) {
                        eprintln!("Error handling connection: {}", e);
                    }
                });
            }
            Err(e) => {
                eprintln!("Error accepting connection: {}", e);
            }
        }
    }
}

fn handle_connection(stream: &mut VsockStream, kms: Arc<Mutex<EnclaveKMS>>) -> Result<()> {
    let mut buffer = Vec::new();
    let mut temp_buffer = [0u8; 1024];
    
    loop {
        match stream.read(&mut temp_buffer) {
            Ok(0) => break, // Connection closed
            Ok(n) => {
                buffer.extend_from_slice(&temp_buffer[..n]);
                
                // Try to parse complete JSON commands
                if let Ok(command) = serde_json::from_slice::<Command>(&buffer) {
                    let response = handle_command(command, kms.clone());
                    let response_json = serde_json::to_string(&response)?;
                    stream.write_all(response_json.as_bytes())?;
                    stream.flush()?;
                    buffer.clear();
                }
            }
            Err(e) => {
                return Err(anyhow!("Read error: {}", e));
            }
        }
    }
    
    Ok(())
}

fn handle_command(command: Command, kms: Arc<Mutex<EnclaveKMS>>) -> Response {
    let mut kms_guard = kms.lock().unwrap();
    
    match command {
        Command::Keygen => {
            match kms_guard.generate_ethereum_account() {
                Ok(account) => {
                    // Encrypt and store the key
                    match kms_guard.encrypt_key(&account.private_key) {
                        Ok(encrypted_key) => {
                            if let Err(e) = kms_guard.store_key(&account.address, &encrypted_key) {
                                return Response {
                                    success: false,
                                    data: None,
                                    error: Some(format!("Failed to store key: {}", e)),
                                };
                            }
                            
                            Response {
                                success: true,
                                data: Some(serde_json::json!({
                                    "address": account.address,
                                    "private_key": account.private_key
                                })),
                                error: None,
                            }
                        }
                        Err(e) => Response {
                            success: false,
                            data: None,
                            error: Some(format!("Failed to encrypt key: {}", e)),
                        },
                    }
                }
                Err(e) => Response {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to generate account: {}", e)),
                },
            }
        }
        Command::Sign { address, message } => {
            match kms_guard.sign_message(&message, &address) {
                Ok(Some(signature)) => Response {
                    success: true,
                    data: Some(serde_json::json!({
                        "signature": signature,
                        "message": message,
                        "address": address
                    })),
                    error: None,
                },
                Ok(None) => Response {
                    success: false,
                    data: None,
                    error: Some("Address not found or signing failed".to_string()),
                },
                Err(e) => Response {
                    success: false,
                    data: None,
                    error: Some(format!("Signing error: {}", e)),
                },
            }
        }
        Command::List => {
            match kms_guard.list_addresses() {
                Ok(addresses) => Response {
                    success: true,
                    data: Some(serde_json::json!({
                        "addresses": addresses,
                        "count": addresses.len()
                    })),
                    error: None,
                },
                Err(e) => Response {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to list addresses: {}", e)),
                },
            }
        }
    }
}
