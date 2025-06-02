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

const PORT: u16 = 7777;
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
    
    // Check if address exists in our dummy data
    let dummy_addresses = vec![
        "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
        "0x8ba1f109551bD432803012645Hac136c22C177ec",
        "0x1234567890123456789012345678901234567890",
    ];
    
    if !dummy_addresses.contains(&payload.address.as_str()) {
        return Err((
            StatusCode::NOT_FOUND,
            ResponseJson(ErrorResponse {
                error: "Address not found".to_string(),
            }),
        ));
    }
    
    // Return dummy signature
    let dummy_signature = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b";
    
    Ok(ResponseJson(SignResponse {
        signature: dummy_signature.to_string(),
    }))
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/generate", post(generate))
        .route("/addresses", get(addresses))
        .route("/sign", post(sign));

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", PORT))
        .await
        .unwrap();
    
    println!("Server running on http://0.0.0.0:{}", PORT);
    
    axum::serve(listener, app).await.unwrap();
}
