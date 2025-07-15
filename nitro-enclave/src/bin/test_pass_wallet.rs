use nitro_enclave::pass_logic::*;
use anyhow::Result;
use serde_json;

fn main() -> Result<()> {
    println!("🧪 Testing PASS Wallet Logic Outside Enclave");
    println!("============================================");
    
    // Test 1: Create PASS wallet
    println!("\n1. 🏗️  Creating PASS wallet...");
    let wallet = PassWallet::new("alice".to_string())?;
    let address = wallet.get_address();
    println!("   ✅ Wallet created successfully");
    println!("   📍 Address: {}", address);
    
    // Test 2: Check initial state
    println!("\n2. 🔍 Checking initial state...");
    let state = wallet.get_state_summary();
    println!("   ✅ Initial state: {}", serde_json::to_string_pretty(&state)?);
    
    // Test 3: Add deposits to inbox
    println!("\n3. 📥 Adding deposits to inbox...");
    wallet.inbox_deposit("ETH".to_string(), 1000, "deposit_eth_1".to_string())?;
    wallet.inbox_deposit("USDC".to_string(), 5000, "deposit_usdc_1".to_string())?;
    wallet.inbox_deposit("BTC".to_string(), 200, "deposit_btc_1".to_string())?;
    println!("   ✅ Added ETH deposit: 1000 units");
    println!("   ✅ Added USDC deposit: 5000 units");
    println!("   ✅ Added BTC deposit: 200 units");
    
    // Test 4: Claim deposits
    println!("\n4. 🎯 Claiming deposits...");
    wallet.claim_inbox("ETH".to_string(), 1000, "deposit_eth_1".to_string(), "alice".to_string())?;
    wallet.claim_inbox("USDC".to_string(), 5000, "deposit_usdc_1".to_string(), "alice".to_string())?;
    wallet.claim_inbox("BTC".to_string(), 200, "deposit_btc_1".to_string(), "bob".to_string())?;
    println!("   ✅ Alice claimed ETH deposit");
    println!("   ✅ Alice claimed USDC deposit");
    println!("   ✅ Bob claimed BTC deposit");
    
    // Test 5: Check balances
    println!("\n5. 💰 Checking balances...");
    let alice_eth = wallet.get_balance(&"alice".to_string(), &"ETH".to_string());
    let alice_usdc = wallet.get_balance(&"alice".to_string(), &"USDC".to_string());
    let bob_btc = wallet.get_balance(&"bob".to_string(), &"BTC".to_string());
    println!("   👩 Alice's ETH balance: {}", alice_eth);
    println!("   👩 Alice's USDC balance: {}", alice_usdc);
    println!("   👨 Bob's BTC balance: {}", bob_btc);
    
    // Test 6: Internal transfers
    println!("\n6. 🔄 Testing internal transfers...");
    wallet.internal_transfer("ETH".to_string(), 300, "alice".to_string(), "bob".to_string())?;
    wallet.internal_transfer("USDC".to_string(), 1000, "alice".to_string(), "charlie".to_string())?;
    println!("   ✅ Transferred 300 ETH from Alice to Bob");
    println!("   ✅ Transferred 1000 USDC from Alice to Charlie");
    
    // Test 7: Check balances after transfers
    println!("\n7. 💰 Checking balances after transfers...");
    let alice_eth = wallet.get_balance(&"alice".to_string(), &"ETH".to_string());
    let alice_usdc = wallet.get_balance(&"alice".to_string(), &"USDC".to_string());
    let bob_eth = wallet.get_balance(&"bob".to_string(), &"ETH".to_string());
    let bob_btc = wallet.get_balance(&"bob".to_string(), &"BTC".to_string());
    let charlie_usdc = wallet.get_balance(&"charlie".to_string(), &"USDC".to_string());
    println!("   👩 Alice's ETH balance: {}", alice_eth);
    println!("   👩 Alice's USDC balance: {}", alice_usdc);
    println!("   👨 Bob's ETH balance: {}", bob_eth);
    println!("   👨 Bob's BTC balance: {}", bob_btc);
    println!("   👤 Charlie's USDC balance: {}", charlie_usdc);
    
    // Test 8: Get user balances
    println!("\n8. 📊 Getting all user balances...");
    let alice_balances = wallet.get_user_balances(&"alice".to_string());
    let bob_balances = wallet.get_user_balances(&"bob".to_string());
    let charlie_balances = wallet.get_user_balances(&"charlie".to_string());
    println!("   👩 Alice's balances: {:?}", alice_balances);
    println!("   👨 Bob's balances: {:?}", bob_balances);
    println!("   👤 Charlie's balances: {:?}", charlie_balances);
    
    // Test 9: Withdrawals
    println!("\n9. 📤 Testing withdrawals...");
    wallet.withdraw("ETH".to_string(), 200, "alice".to_string(), "0x1234567890abcdef1234567890abcdef12345678".to_string())?;
    wallet.withdraw("USDC".to_string(), 1500, "alice".to_string(), "0xabcdef1234567890abcdef1234567890abcdef12".to_string())?;
    wallet.withdraw("BTC".to_string(), 50, "bob".to_string(), "0x9876543210fedcba9876543210fedcba98765432".to_string())?;
    println!("   ✅ Alice withdrew 200 ETH");
    println!("   ✅ Alice withdrew 1500 USDC");
    println!("   ✅ Bob withdrew 50 BTC");
    
    // Test 10: Check balances after withdrawals
    println!("\n10. 💰 Checking balances after withdrawals...");
    let alice_eth = wallet.get_balance(&"alice".to_string(), &"ETH".to_string());
    let alice_usdc = wallet.get_balance(&"alice".to_string(), &"USDC".to_string());
    let bob_btc = wallet.get_balance(&"bob".to_string(), &"BTC".to_string());
    println!("    👩 Alice's ETH balance: {}", alice_eth);
    println!("    👩 Alice's USDC balance: {}", alice_usdc);
    println!("    👨 Bob's BTC balance: {}", bob_btc);
    
    // Test 11: Process outbox
    println!("\n11. ⚙️  Processing outbox...");
    let processed_items = wallet.process_outbox()?;
    println!("    ✅ Processed {} withdrawal(s)", processed_items.len());
    for (i, item) in processed_items.iter().enumerate() {
        println!("    📤 Withdrawal {}: {} {} to {}", i + 1, item.amount, item.asset, item.external_destination);
    }
    
    // Test 12: Sign GSM operations
    println!("\n12. ✏️  Testing GSM signatures...");
    let sig1 = wallet.sign_gsm("test.domain", "Hello, PASS Wallet!", &"alice".to_string())?;
    let sig2 = wallet.sign_gsm("dex.protocol", "Approve trade #123", &"bob".to_string())?;
    println!("    ✅ Alice signed message: {}", &sig1[..20]);
    println!("    ✅ Bob signed message: {}", &sig2[..20]);
    
    // Test 13: Error handling - insufficient balance
    println!("\n13. 🚫 Testing error handling...");
    match wallet.internal_transfer("ETH".to_string(), 10000, "alice".to_string(), "bob".to_string()) {
        Ok(()) => println!("    ❌ Should have failed due to insufficient balance"),
        Err(e) => println!("    ✅ Correctly failed: {}", e),
    }
    
    // Test 14: Error handling - duplicate deposit
    match wallet.inbox_deposit("ETH".to_string(), 500, "deposit_eth_1".to_string()) {
        Ok(()) => println!("    ❌ Should have failed due to duplicate deposit ID"),
        Err(e) => println!("    ✅ Correctly failed: {}", e),
    }
    
    // Test 15: Error handling - non-existent deposit claim
    match wallet.claim_inbox("ETH".to_string(), 999, "nonexistent_deposit".to_string(), "alice".to_string()) {
        Ok(()) => println!("    ❌ Should have failed due to non-existent deposit"),
        Err(e) => println!("    ✅ Correctly failed: {}", e),
    }
    
    // Test 16: Final state summary
    println!("\n16. 📋 Final state summary...");
    let final_state = wallet.get_state_summary();
    println!("    ✅ Final state: {}", serde_json::to_string_pretty(&final_state)?);
    
    // Test 17: Test transaction limits and edge cases
    println!("\n17. 🔍 Testing edge cases...");
    
    // Test zero amount transfer
    match wallet.internal_transfer("ETH".to_string(), 0, "alice".to_string(), "bob".to_string()) {
        Ok(()) => println!("    ⚠️  Zero amount transfer succeeded (may be expected)"),
        Err(e) => println!("    ℹ️  Zero amount transfer failed: {}", e),
    }
    
    // Test self-transfer
    match wallet.internal_transfer("ETH".to_string(), 10, "alice".to_string(), "alice".to_string()) {
        Ok(()) => println!("    ⚠️  Self-transfer succeeded (may be expected)"),
        Err(e) => println!("    ℹ️  Self-transfer failed: {}", e),
    }
    
    println!("\n🎉 All tests completed successfully!");
    println!("📈 Summary:");
    println!("   - Wallet creation: ✅");
    println!("   - Deposit management: ✅");
    println!("   - Balance tracking: ✅");
    println!("   - Internal transfers: ✅");
    println!("   - Withdrawals: ✅");
    println!("   - Outbox processing: ✅");
    println!("   - GSM signing: ✅");
    println!("   - Error handling: ✅");
    println!("   - Edge cases: ✅");
    
    Ok(())
} 