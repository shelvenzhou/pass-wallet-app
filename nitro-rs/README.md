# Nitro Enclave KMS Server

A secure Key Management System (KMS) running in an AWS Nitro Enclave that provides Ethereum key generation, signing, and management capabilities over vsock communication.

## Features

- **Key Generation**: Generate new Ethereum accounts with encrypted private key storage
- **Message Signing**: Sign messages using stored private keys
- **Key Management**: List all stored addresses
- **Secure Storage**: Private keys are encrypted using AES-256-GCM
- **Vsock Communication**: Secure communication channel between host and enclave

## Commands

The server accepts JSON commands over vsock port 7777:

### Keygen
Generate a new Ethereum account:
```json
{"Keygen": null}
```

Response:
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "private_key": "0x..."
  },
  "error": null
}
```

### Sign
Sign a message with a stored private key:
```json
{
  "Sign": {
    "address": "0x...",
    "message": "Hello, World!"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "signature": "0x...",
    "message": "Hello, World!",
    "address": "0x..."
  },
  "error": null
}
```

### List
List all stored addresses:
```json
{"List": null}
```

Response:
```json
{
  "success": true,
  "data": {
    "addresses": ["0x...", "0x..."],
    "count": 2
  },
  "error": null
}
```

## Building

```bash
cargo build --release
```

## Running

Set the enclave secret (optional, defaults to "test_secret"):
```bash
export ENCLAVE_SECRET="your-secure-secret-here"
cargo run --release
```

The server will start listening on vsock port 7777.

## Testing

Use the provided test client:
```bash
cargo run --bin test_client
```

Or create your own client using the vsock library:
```rust
use vsock::VsockStream;
use serde_json::json;

let mut stream = VsockStream::connect(7777)?;
let command = json!({"Keygen": null});
stream.write_all(serde_json::to_string(&command)?.as_bytes())?;
```

## Security Features

- **Encrypted Storage**: All private keys are encrypted using AES-256-GCM
- **Isolated Environment**: Runs in AWS Nitro Enclave for hardware-level isolation
- **Secure Communication**: Uses vsock for encrypted communication between host and enclave
- **Memory Protection**: Private keys are never exposed in plain text outside the enclave

## Architecture

- **EnclaveKMS**: Main KMS implementation with encryption/decryption capabilities
- **Vsock Server**: Async server handling multiple concurrent connections
- **Command Handler**: JSON-based command processing with structured responses
- **Thread-Safe Storage**: Uses Arc<Mutex<>> for safe concurrent access to keystore

## Dependencies

- `tokio`: Async runtime
- `vsock`: Vsock communication
- `k256`: Ethereum cryptography
- `aes-gcm`: Encryption
- `serde`: JSON serialization
- `anyhow`: Error handling

```bash
rustup target add x86_64-unknown-linux-musl
cargo build --target=x86_64-unknown-linux-musl --release
docker build -t nitro-rs .
nitro-cli build-enclave --docker-dir ./ --docker-uri nitro-rs --output-file nitro-rs.eif
nitro-cli run-enclave --eif-path <EIF_PATH> --cpu-count 2  --memory 256 --debug-mode
```

View and Stop Enclave
```bash
nitro-cli describe-enclaves
nitro-cli console --enclave-id <ENCLAVE_ID>
nitro-cli terminate-enclave --enclave-id <ENCLAVE_ID>
```



