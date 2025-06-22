use serde_json::json;
use std::io::{Read, Write};
use vsock::VsockStream;

#[derive(serde::Serialize)]
enum Command {
    Keygen,
    Sign { address: String, message: String },
    List,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Connect to the enclave on vsock port 7777
    let mut stream = VsockStream::connect(&7777)?;
    println!("Connected to enclave KMS");

    // Test keygen command
    println!("\n=== Testing Keygen ===");
    let keygen_cmd = json!(Command::Keygen);
    let keygen_json = serde_json::to_string(&keygen_cmd)?;
    stream.write_all(keygen_json.as_bytes())?;
    stream.flush()?;

    let mut response = String::new();
    stream.read_to_string(&mut response)?;
    println!("Keygen response: {}", response);

    // Parse the response to get the address for signing
    let response_data: serde_json::Value = serde_json::from_str(&response)?;
    let address = if let Some(data) = response_data["data"].as_object() {
        data["address"].as_str().unwrap_or("")
    } else {
        ""
    };

    if !address.is_empty() {
        // Test sign command
        println!("\n=== Testing Sign ===");
        let sign_cmd = json!(Command::Sign {
            address: address.to_string(),
            message: "Hello, Enclave!".to_string(),
        });
        let sign_json = serde_json::to_string(&sign_cmd)?;
        
        // Create a new connection for the sign command
        let mut sign_stream = VsockStream::connect(&7777)?;
        sign_stream.write_all(sign_json.as_bytes())?;
        sign_stream.flush()?;

        let mut sign_response = String::new();
        sign_stream.read_to_string(&mut sign_response)?;
        println!("Sign response: {}", sign_response);
    }

    // Test list command
    println!("\n=== Testing List ===");
    let list_cmd = json!(Command::List);
    let list_json = serde_json::to_string(&list_cmd)?;
    
    let mut list_stream = VsockStream::connect(&7777)?;
    list_stream.write_all(list_json.as_bytes())?;
    list_stream.flush()?;

    let mut list_response = String::new();
    list_stream.read_to_string(&mut list_response)?;
    println!("List response: {}", list_response);

    Ok(())
} 