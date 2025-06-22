# Axum Relay Server

A HTTP API relay server that communicates with the Nitro Enclave KMS over vsock. This server provides a RESTful interface for key generation, message signing, and address management.

## Features

- **HTTP API**: RESTful endpoints for easy integration
- **Vsock Communication**: Secure communication with the enclave
- **Error Handling**: Comprehensive error responses
- **JSON Protocol**: All requests and responses use JSON format

## API Endpoints

### Generate Account
**POST** `/generate`

Generate a new Ethereum account in the enclave.

**Response:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
  "private_key": "0x1234567890abcdef...",
  "message": "Account generated and stored in enclave"
}
```

### List Addresses
**GET** `/addresses`

Get all stored Ethereum addresses.

**Response:**
```json
{
  "addresses": [
    "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
    "0x8ba1f109551bD432803012645Hac136c22C177ec"
  ],
  "count": 2
}
```

### Sign Message
**POST** `/sign`

Sign a message with a stored private key.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
  "message": "Hello, World!"
}
```

**Response:**
```json
{
  "signature": "0x1234567890abcdef...",
  "message": "Hello, World!",
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87"
}
```

## Configuration

The server can be configured by modifying the constants in `src/main.rs`:

```rust
const HTTP_PORT: u16 = 7777;      // HTTP server port
const VSOCK_CID: u32 = 3;         // Enclave CID
const VSOCK_PORT: u32 = 7777;     // Enclave vsock port
```

## Building and Running

### Build
```bash
cargo build --release
```

### Run
```bash
cargo run --release
```

The server will start on `http://0.0.0.0:7777`

## Testing

### Using the Python test script
```bash
python3 test_api.py
```

### Using curl
```bash
# Generate account
curl -X POST http://localhost:7777/generate

# List addresses
curl http://localhost:7777/addresses

# Sign message
curl -X POST http://localhost:7777/sign \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b8D4C9db96590c6C87","message":"Hello"}'
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "error": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing required fields)
- `500`: Internal Server Error (enclave communication error)

## Architecture

```
HTTP Client → Axum Relay → Vsock → Nitro Enclave
```

1. **HTTP Client**: Sends REST API requests
2. **Axum Relay**: Converts HTTP requests to vsock commands
3. **Vsock**: Secure communication channel
4. **Nitro Enclave**: Processes commands and returns responses

## Dependencies

- `axum`: HTTP web framework
- `tokio`: Async runtime
- `tokio-vsock`: Vsock communication
- `serde`: JSON serialization
- `anyhow`: Error handling

## Security

- **Vsock Communication**: Encrypted communication between host and enclave
- **Enclave Isolation**: All cryptographic operations happen in the secure enclave
- **No Key Exposure**: Private keys are never exposed outside the enclave
