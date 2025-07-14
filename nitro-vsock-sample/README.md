# Vsock Proxy Server

- Nitro Vsock example documentation and deployment in [NITRO_VSOCK.md](NITRO_VSOCK.md)
- `lib.rs` contains entrypoint code for client/server.
- `http_main` and `http_client` contain code for the proxy server.
- Start proxy server: `nitro-vsock-sample]$ cargo run --bin http-server`
- Proxy Server created using Axum

# Quick Start

## Step 1: Begin Nitro Enclave Server

Create EIF Image:
```bash
make server
```

Deploy EIF Image to Enclave, get Enclave ID ("i-xxxx")
```
nitro-cli run-enclave --eif-path vsock_sample_server.eif --cpu-count 2 --memory 256 --debug-mode
```

Check Enclave Console
```
nitro-cli console --enclave-id <ENCLAVE_ID>
```

## Step 2 (Optional): Launch Test Client Code

```bash
make run-client
```

## Step 3: Launch HTTP Server
```bash
export ENCLAVE_CID=16 # Replace with actual Enclave CID
cargo run --bin http-server
```

HTTP server provides these endpoints:
POST /generate - Generate a new wallet address
GET /addresses - List all stored addresses
POST /sign - Sign a message with a specific address

```bash
# Generate a new wallet
curl -X POST http://localhost:5000/generate

# List addresses
curl http://localhost:5000/addresses

# Sign a message
curl -X POST http://localhost:5000/sign \
  -H "Content-Type: application/json" \
  -d '{"address": "0x...", "message": "Hello World"}'
```

# Architecture Flow

```
HTTP Client → HTTP Server (Port 5000) → Vsock → Enclave Server (Port 7777)
     ↑                                                      ↓
HTTP Response ← HTTP Server ← Vsock ← Enclave Response
```
