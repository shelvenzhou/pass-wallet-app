use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::convert::TryInto;
use std::sync::{Arc, Mutex};
use anyhow::{Result, anyhow};
use k256::{SecretKey, PublicKey, ecdsa::{SigningKey}};
use k256::elliptic_curve::sec1::ToEncodedPoint;
use rand::RngCore;
use sha3::{Keccak256, Digest};
use hex;

/// Asset type identifier (e.g., "ETH", "USDC", etc.)
pub type AssetType = String;

/// User ID in the system
pub type UserId = String;

/// Deposit ID for tracking external deposits
pub type DepositId = String;

/// External destination address for withdrawals
pub type ExternalDestination = String;

/// Ethereum Address (EOA)
pub type EthereumAddress = String;

/// Deposit entry in the inbox
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deposit {
    pub asset: AssetType,
    pub amount: u64,
    pub deposit_id: DepositId,
}

/// Outbox entry for withdrawals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxEntry {
    pub asset: AssetType,
    pub amount: u64,
    pub external_destination: ExternalDestination,
    pub nonce: u64,
}

/// Transaction operation types for provenance history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionOperation {
    Claim { asset: AssetType, amount: u64, deposit_id: DepositId, user: UserId },
    Transfer { asset: AssetType, amount: u64, from: UserId, to: UserId },
    Withdraw { asset: AssetType, amount: u64, user: UserId, destination: ExternalDestination },
}

/// Provenance history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceRecord {
    pub operation: TransactionOperation,
    pub timestamp: u64,
    pub block_number: Option<u64>,
}

/// Global state of the PASS wallet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassWalletState {
    /// Public key/address (EOA)
    pub pk: EthereumAddress,
    /// Private key (stored in TEE)
    pub sk: String,
    /// Global nonce for on-chain transactions
    pub v: u64,
    /// Inbox: set of unclaimed deposits
    pub inbox: Vec<Deposit>,
    /// Outbox: FIFO queue for withdrawals
    pub outbox: VecDeque<OutboxEntry>,
    /// Asset Ledger: internal map L[user][asset] ∈ Z≥0
    pub ledger: HashMap<UserId, HashMap<AssetType, u64>>,
    /// Provenance History: list of transaction records
    pub history: Vec<ProvenanceRecord>,
    /// Creator of the wallet
    pub creator: UserId,
}

impl PassWalletState {
    /// Create a new PASS wallet instance
    pub fn create_pass_wallet(creator: UserId) -> Result<Self> {
        // Generate TEE key pair
        let mut rng = rand::thread_rng();
        let mut private_key_bytes = [0u8; 32];
        rng.fill_bytes(&mut private_key_bytes);
        
        let secret_key = SecretKey::from_bytes(&private_key_bytes.into())?;
        let public_key = secret_key.public_key();
        
        // Generate Ethereum address from public key
        let pk = Self::public_key_to_address(&public_key);
        let sk = format!("0x{}", hex::encode(private_key_bytes));
        
        Ok(PassWalletState {
            pk,
            sk,
            v: 0,
            inbox: Vec::new(),
            outbox: VecDeque::new(),
            ledger: HashMap::new(),
            history: Vec::new(),
            creator,
        })
    }
    
    /// Convert public key to Ethereum address
    fn public_key_to_address(public_key: &PublicKey) -> String {
        let encoded = public_key.to_encoded_point(false);
        let public_key_bytes = encoded.as_bytes();
        
        // Skip the 0x04 prefix for uncompressed public key
        let hash = Keccak256::digest(&public_key_bytes[1..]);
        let address = &hash[12..];
        format!("0x{}", hex::encode(address))
    }
    
    /// Add external deposit to inbox
    pub fn inbox_deposit(&mut self, asset: AssetType, amount: u64, deposit_id: DepositId) -> Result<()> {
        // Check if deposit ID already exists
        if self.inbox.iter().any(|d| d.deposit_id == deposit_id) {
            return Err(anyhow!("Deposit ID already exists"));
        }
        
        let deposit = Deposit {
            asset,
            amount,
            deposit_id,
        };
        
        self.inbox.push(deposit);
        Ok(())
    }
    
    /// Claim deposit from inbox
    pub fn claim_inbox(&mut self, asset: AssetType, amount: u64, deposit_id: DepositId, user: UserId) -> Result<()> {
        // Find and remove the deposit from inbox
        let deposit_index = self.inbox.iter().position(|d| 
            d.asset == asset && d.amount == amount && d.deposit_id == deposit_id
        ).ok_or_else(|| anyhow!("Deposit not found in inbox"))?;
        
        let _deposit = self.inbox.remove(deposit_index);
        
        // Update ledger
        self.ledger.entry(user.clone())
            .or_insert_with(HashMap::new)
            .entry(asset.clone())
            .and_modify(|balance| *balance += amount)
            .or_insert(amount);
        
        // Add to provenance history
        self.history.push(ProvenanceRecord {
            operation: TransactionOperation::Claim {
                asset,
                amount,
                deposit_id,
                user,
            },
            timestamp: Self::get_timestamp(),
            block_number: None,
        });
        
        Ok(())
    }
    
    /// Check if a user is allowed to perform a transaction
    pub fn check_allow(&self, user: &UserId, asset: &AssetType, amount: u64) -> bool {
        // For now, implement basic balance check
        // This can be extended with more sophisticated provenance-based checks
        self.ledger.get(user)
            .and_then(|user_assets| user_assets.get(asset))
            .map(|balance| *balance >= amount)
            .unwrap_or(false)
    }
    
    /// Internal transfer between users
    pub fn internal_transfer(&mut self, asset: AssetType, amount: u64, from: UserId, to: UserId) -> Result<()> {
        // Check if sender has sufficient balance and is allowed
        if !self.check_allow(&from, &asset, amount) {
            return Err(anyhow!("Insufficient balance or not allowed"));
        }
        
        // Get sender's balance
        let sender_balance = self.ledger.get_mut(&from)
            .and_then(|user_assets| user_assets.get_mut(&asset))
            .ok_or_else(|| anyhow!("Sender asset not found"))?;
        
        if *sender_balance < amount {
            return Err(anyhow!("Insufficient balance"));
        }
        
        // Update sender's balance
        *sender_balance -= amount;
        
        // Update receiver's balance
        self.ledger.entry(to.clone())
            .or_insert_with(HashMap::new)
            .entry(asset.clone())
            .and_modify(|balance| *balance += amount)
            .or_insert(amount);
        
        // Add to provenance history
        self.history.push(ProvenanceRecord {
            operation: TransactionOperation::Transfer {
                asset,
                amount,
                from,
                to,
            },
            timestamp: Self::get_timestamp(),
            block_number: None,
        });
        
        Ok(())
    }
    
    /// Withdraw to external destination
    pub fn withdraw(&mut self, asset: AssetType, amount: u64, user: UserId, external_destination: ExternalDestination) -> Result<()> {
        // Check if user has sufficient balance and is allowed
        if !self.check_allow(&user, &asset, amount) {
            return Err(anyhow!("Insufficient balance or not allowed"));
        }
        
        // Get user's balance
        let user_balance = self.ledger.get_mut(&user)
            .and_then(|user_assets| user_assets.get_mut(&asset))
            .ok_or_else(|| anyhow!("User asset not found"))?;
        
        if *user_balance < amount {
            return Err(anyhow!("Insufficient balance"));
        }
        
        // Update user's balance
        *user_balance -= amount;
        
        // Add to outbox
        self.outbox.push_back(OutboxEntry {
            asset: asset.clone(),
            amount,
            external_destination: external_destination.clone(),
            nonce: self.v,
        });
        
        // Add to provenance history
        self.history.push(ProvenanceRecord {
            operation: TransactionOperation::Withdraw {
                asset,
                amount,
                user,
                destination: external_destination,
            },
            timestamp: Self::get_timestamp(),
            block_number: None,
        });
        
        Ok(())
    }
    
    /// Sign GSM (Generic State Machine) operations
    pub fn sign_gsm(&self, domain: &str, message: &str, _user: &UserId) -> Result<String> {
        // Check if user has signing rights (for now, allow all users)
        // This can be extended with more sophisticated access control
        
        // Create signing key from private key
        let private_key_clean = self.sk.strip_prefix("0x").unwrap_or(&self.sk);
        let private_key_bytes = hex::decode(private_key_clean)?;
        if private_key_bytes.len() != 32 {
            return Err(anyhow!("Invalid private key length"));
        }
        let private_key_array: [u8; 32] = private_key_bytes.try_into().unwrap();
        let secret_key = SecretKey::from_bytes(&private_key_array.into())?;
        let signing_key = SigningKey::from(secret_key);
        
        // Create message hash
        let full_message = format!("{}:{}", domain, message);
        let message_hash = self.hash_message(&full_message);
        
        // Sign the message
        let (signature, recovery_id) = signing_key.sign_prehash_recoverable(&message_hash)?;
        
        // Combine signature and recovery ID
        let mut signature_bytes = signature.to_bytes().to_vec();
        signature_bytes.push(recovery_id.to_byte() + 27);
        
        Ok(format!("0x{}", hex::encode(signature_bytes)))
    }
    
    /// Process outbox (periodic or on-demand)
    pub fn process_outbox(&mut self) -> Result<Vec<OutboxEntry>> {
        let mut processed = Vec::new();
        
        // Process all items in outbox
        while let Some(entry) = self.outbox.pop_front() {
            // In a real implementation, this would:
            // 1. Build transaction τ: transfer entry.amount of entry.asset to entry.external_destination
            // 2. Sign transaction with private key
            // 3. Broadcast transaction
            // 4. Increment nonce
            
            processed.push(entry);
            self.v += 1;
        }
        
        Ok(processed)
    }
    
    /// Get user's balance for a specific asset
    pub fn get_balance(&self, user: &UserId, asset: &AssetType) -> u64 {
        self.ledger.get(user)
            .and_then(|user_assets| user_assets.get(asset))
            .copied()
            .unwrap_or(0)
    }
    
    /// Get all balances for a user
    pub fn get_user_balances(&self, user: &UserId) -> HashMap<AssetType, u64> {
        self.ledger.get(user)
            .cloned()
            .unwrap_or_default()
    }
    
    /// Get current state summary
    pub fn get_state_summary(&self) -> serde_json::Value {
        serde_json::json!({
            "address": self.pk,
            "nonce": self.v,
            "inbox_count": self.inbox.len(),
            "outbox_count": self.outbox.len(),
            "user_count": self.ledger.len(),
            "history_count": self.history.len(),
            "creator": self.creator
        })
    }
    
    /// Helper function to hash messages
    fn hash_message(&self, message: &str) -> [u8; 32] {
        let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
        let mut hasher = Keccak256::new();
        hasher.update(prefix.as_bytes());
        hasher.update(message.as_bytes());
        hasher.finalize().into()
    }
    
    /// Helper function to get current timestamp
    fn get_timestamp() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

/// Thread-safe PASS wallet instance
pub struct PassWallet {
    state: Arc<Mutex<PassWalletState>>,
}

impl PassWallet {
    /// Create new PASS wallet
    pub fn new(creator: UserId) -> Result<Self> {
        let state = PassWalletState::create_pass_wallet(creator)?;
        Ok(PassWallet {
            state: Arc::new(Mutex::new(state)),
        })
    }
    
    /// Execute inbox deposit
    pub fn inbox_deposit(&self, asset: AssetType, amount: u64, deposit_id: DepositId) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.inbox_deposit(asset, amount, deposit_id)
    }
    
    /// Execute claim inbox
    pub fn claim_inbox(&self, asset: AssetType, amount: u64, deposit_id: DepositId, user: UserId) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.claim_inbox(asset, amount, deposit_id, user)
    }
    
    /// Execute internal transfer
    pub fn internal_transfer(&self, asset: AssetType, amount: u64, from: UserId, to: UserId) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.internal_transfer(asset, amount, from, to)
    }
    
    /// Execute withdrawal
    pub fn withdraw(&self, asset: AssetType, amount: u64, user: UserId, external_destination: ExternalDestination) -> Result<()> {
        let mut state = self.state.lock().unwrap();
        state.withdraw(asset, amount, user, external_destination)
    }
    
    /// Sign GSM operation
    pub fn sign_gsm(&self, domain: &str, message: &str, user: &UserId) -> Result<String> {
        let state = self.state.lock().unwrap();
        state.sign_gsm(domain, message, user)
    }
    
    /// Process outbox
    pub fn process_outbox(&self) -> Result<Vec<OutboxEntry>> {
        let mut state = self.state.lock().unwrap();
        state.process_outbox()
    }
    
    /// Get user balance
    pub fn get_balance(&self, user: &UserId, asset: &AssetType) -> u64 {
        let state = self.state.lock().unwrap();
        state.get_balance(user, asset)
    }
    
    /// Get all user balances
    pub fn get_user_balances(&self, user: &UserId) -> HashMap<AssetType, u64> {
        let state = self.state.lock().unwrap();
        state.get_user_balances(user)
    }
    
    /// Get state summary
    pub fn get_state_summary(&self) -> serde_json::Value {
        let state = self.state.lock().unwrap();
        state.get_state_summary()
    }
    
    /// Get wallet address
    pub fn get_address(&self) -> String {
        let state = self.state.lock().unwrap();
        state.pk.clone()
    }
}

// Global PASS wallet instance
lazy_static::lazy_static! {
    static ref PASS_WALLET: Option<PassWallet> = None;
}

/// Initialize the global PASS wallet
pub fn initialize_pass_wallet(creator: UserId) -> Result<()> {
    let _wallet = PassWallet::new(creator)?;
    // In a real implementation, you would properly initialize the global state
    // For now, we'll return the wallet instance
    Ok(())
}

/// Get the global PASS wallet instance
pub fn get_pass_wallet() -> Option<&'static PassWallet> {
    PASS_WALLET.as_ref()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_create_pass_wallet() {
        let wallet = PassWalletState::create_pass_wallet("creator1".to_string()).unwrap();
        assert_eq!(wallet.creator, "creator1");
        assert_eq!(wallet.v, 0);
        assert!(wallet.inbox.is_empty());
        assert!(wallet.outbox.is_empty());
        assert!(wallet.ledger.is_empty());
        assert!(wallet.history.is_empty());
    }
    
    #[test]
    fn test_inbox_deposit_and_claim() {
        let mut wallet = PassWalletState::create_pass_wallet("creator1".to_string()).unwrap();
        
        // Add deposit to inbox
        wallet.inbox_deposit("ETH".to_string(), 1000, "deposit1".to_string()).unwrap();
        assert_eq!(wallet.inbox.len(), 1);
        
        // Claim deposit
        wallet.claim_inbox("ETH".to_string(), 1000, "deposit1".to_string(), "user1".to_string()).unwrap();
        assert_eq!(wallet.inbox.len(), 0);
        assert_eq!(wallet.get_balance(&"user1".to_string(), &"ETH".to_string()), 1000);
        assert_eq!(wallet.history.len(), 1);
    }
    
    #[test]
    fn test_internal_transfer() {
        let mut wallet = PassWalletState::create_pass_wallet("creator1".to_string()).unwrap();
        
        // Setup initial balance
        wallet.inbox_deposit("ETH".to_string(), 1000, "deposit1".to_string()).unwrap();
        wallet.claim_inbox("ETH".to_string(), 1000, "deposit1".to_string(), "user1".to_string()).unwrap();
        
        // Transfer
        wallet.internal_transfer("ETH".to_string(), 500, "user1".to_string(), "user2".to_string()).unwrap();
        
        assert_eq!(wallet.get_balance(&"user1".to_string(), &"ETH".to_string()), 500);
        assert_eq!(wallet.get_balance(&"user2".to_string(), &"ETH".to_string()), 500);
        assert_eq!(wallet.history.len(), 2);
    }
    
    #[test]
    fn test_withdraw() {
        let mut wallet = PassWalletState::create_pass_wallet("creator1".to_string()).unwrap();
        
        // Setup initial balance
        wallet.inbox_deposit("ETH".to_string(), 1000, "deposit1".to_string()).unwrap();
        wallet.claim_inbox("ETH".to_string(), 1000, "deposit1".to_string(), "user1".to_string()).unwrap();
        
        // Withdraw
        wallet.withdraw("ETH".to_string(), 300, "user1".to_string(), "0x1234567890abcdef".to_string()).unwrap();
        
        assert_eq!(wallet.get_balance(&"user1".to_string(), &"ETH".to_string()), 700);
        assert_eq!(wallet.outbox.len(), 1);
        assert_eq!(wallet.history.len(), 2);
    }
}
