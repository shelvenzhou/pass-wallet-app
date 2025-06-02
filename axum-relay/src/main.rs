use axum::{
    extract::Json,
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio;
use tokio_vsock::VsockStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Deserialize)]
struct SignRequest {
    address: String,
    message: String,
}

#[derive(Serialize)]
struct GenerateResponse {
    address: String,
    message: String,
}

#[derive(Serialize)]
struct SignResponse {
    signature: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

// Constants
const HTTP_PORT: u16 = 7777;
const VSOCK_CID: u32 = 3;
const VSOCK_PORT: u32 = 7778;


async fn send_to_enclave_vsock(request: &SignRequest) -> Result<String, String> {
    let mut stream = VsockStream::connect(ENCLAVE_CID, ENCLAVE_PORT)
        .await
        .map_err(|e| format!("Failed to connect to enclave: {}", e))?;

    let json_payload = serde_json::to_string(request)
        .map_err(|e| format!("Serialization error: {}", e))?;

    stream.write_all(json_payload.as_bytes())
        .await
        .map_err(|e| format!("Write error: {}", e))?;
    
    stream.shutdown().await.ok(); // signal EOF

    let mut buf = Vec::new();
    stream.read_to_end(&mut buf)
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    String::from_utf8(buf).map_err(|e| format!("UTF-8 error: {}", e))
}

async fn generate() -> Result<ResponseJson<GenerateResponse>, (StatusCode, ResponseJson<ErrorResponse>)> {
    // Return dummy data for now
    let response = GenerateResponse {
        address: "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87".to_string(),
        message: "Account generated and stored in enclave".to_string(),
    };
    
    Ok(ResponseJson(response))
}

async fn addresses() -> ResponseJson<Vec<String>> {
    // Return dummy addresses for now
    let dummy_addresses = vec![
        "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87".to_string(),
        "0x8ba1f109551bD432803012645Hac136c22C177ec".to_string(),
        "0x1234567890123456789012345678901234567890".to_string(),
    ];
    
    ResponseJson(dummy_addresses)
}

async fn sign(
    Json(payload): Json<SignRequest>,
) -> Result<ResponseJson<SignResponse>, (StatusCode, ResponseJson<ErrorResponse>)> {
    println!("Signing message: {} for address: {}", payload.message, payload.address);

    if payload.address.is_empty() || payload.message.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            ResponseJson(ErrorResponse {
                error: "Address and message required".to_string(),
            }),
        ));
    }

    match send_to_enclave_vsock(&payload).await {
        Ok(signature) => Ok(ResponseJson(SignResponse { signature })),
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            ResponseJson(ErrorResponse { error: err }),
        )),
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/generate", post(generate))
        .route("/addresses", get(addresses))
        .route("/sign", post(sign));

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", HTTP_PORT))
        .await
        .unwrap();
    
    println!("Server running on http://0.0.0.0:{}", HTTP_PORT);
    
    axum::serve(listener, app).await.unwrap();
}
