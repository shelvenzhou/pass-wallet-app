use axum::{
    extract::Json,
    http::{Method, StatusCode},
    response::Json as JsonResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use std::convert::TryInto;
use crate::{vsock_connect, protocol_helpers::{send_loop, send_u64, recv_loop, recv_u64}};
use std::os::unix::io::AsRawFd;
use crate::server_logic::Response;

const BUF_MAX_LEN: usize = 8192;

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

// Command: Generate account
async fn generate_handler(Json(_args): Json<Option<serde_json::Value>>) -> Result<JsonResponse<GenerateResponse>, (StatusCode, JsonResponse<ErrorResponse>)> {
    println!("Generating account");
    let cid = std::env::var("ENCLAVE_CID").unwrap_or_else(|_| "19".to_string()).parse::<u32>()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
            error: "Invalid ENCLAVE_CID".to_string(),
        })))?;
    
    let port = 7777u32;
    
    let command = serde_json::json!({
        "Keygen": null
    });
    
    match send_command_to_enclave(cid, port, &command.to_string()).await {
        Ok(response) => {
            if let Some(data) = response.data {
                if let Some(address) = data.get("address").and_then(|v| v.as_str()) {
                    return Ok(JsonResponse(GenerateResponse {
                        address: address.to_string(),
                        message: "Account generated and stored in enclave".to_string(),
                    }));
                }
            }
            Err((StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
                error: "Failed to generate account".to_string(),
            })))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
            error: format!("Enclave communication error: {}", e),
        })))
    }
}

// Command: List addresses
async fn addresses_handler() -> Result<JsonResponse<Vec<String>>, (StatusCode, JsonResponse<ErrorResponse>)> {
    let cid = std::env::var("ENCLAVE_CID").unwrap_or_else(|_| "19".to_string()).parse::<u32>()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
            error: "Invalid ENCLAVE_CID".to_string(),
        })))?;
    
    let port = 7777u32;
    
    let command = serde_json::json!({
        "List": null
    });
    match send_command_to_enclave(cid, port, &command.to_string()).await {
        Ok(response) => {
            if let Some(data) = response.data {

                if let Some(addresses) = data.as_array() {
                    println!("Addresses: {:?}", addresses);
                    let address_list: Vec<String> = addresses.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                    return Ok(JsonResponse(address_list));
                }
            }
            Err((StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
                error: "Failed to list addresses".to_string(),
            })))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
            error: format!("Enclave communication error: {}", e),
        })))
    }
}

async fn sign_handler(Json(request): Json<SignRequest>) -> Result<JsonResponse<SignResponse>, (StatusCode, JsonResponse<ErrorResponse>)> {
    let cid = std::env::var("ENCLAVE_CID").unwrap_or_else(|_| "19".to_string()).parse::<u32>()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
            error: "Invalid ENCLAVE_CID".to_string(),
        })))?;
    
    let port = 7777u32;
    
    let command = serde_json::json!({
        "Sign": {
            "address": request.address,
            "message": request.message
        }
    });
    
    match send_command_to_enclave(cid, port, &command.to_string()).await {
        Ok(response) => {
            if let Some(data) = response.data {
                if let Some(signature) = data.get("signature").and_then(|v| v.as_str()) {
                    return Ok(JsonResponse(SignResponse {
                        signature: signature.to_string(),
                    }));
                }
            }
            Err((StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
                error: "Failed to sign message".to_string(),
            })))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, JsonResponse(ErrorResponse {
            error: format!("Enclave communication error: {}", e),
        })))
    }
}

// Send command to enclave and receive response
async fn send_command_to_enclave(cid: u32, port: u32, command: &str) -> Result<Response, String> {
    let vsocket = vsock_connect(cid, port)?;
    let fd = vsocket.as_raw_fd();

    println!("Sending command to enclave: {}", command);

    // Send command to enclave
    let buf = command.as_bytes();
    let len: u64 = buf.len().try_into().map_err(|err| format!("{:?}", err))?;
    send_u64(fd, len)?;
    send_loop(fd, buf, len)?;

    // Receive response from enclave
    let mut response_buf = [0u8; BUF_MAX_LEN];
    let response_len = recv_u64(fd)?;
    recv_loop(fd, &mut response_buf, response_len)?;
    
    let response_str = String::from_utf8(response_buf[..response_len as usize].to_vec())
        .map_err(|err| format!("The received bytes are not UTF-8: {:?}", err))?;
    
    let response: Response = serde_json::from_str(&response_str)
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(response)
}

pub async fn run_http_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any);

    let app = Router::new()
        .route("/generate", post(generate_handler))
        .route("/addresses", get(addresses_handler))
        .route("/sign", post(sign_handler))
        .layer(cors);

    println!("HTTP server listening on port {}", port);
    
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
} 