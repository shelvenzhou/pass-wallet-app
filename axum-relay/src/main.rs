use axum::{
    extract::Json,
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tokio;
use tokio_vsock::VsockStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use std::net::Shutdown;

#[derive(Deserialize, Serialize)]
struct SignRequest {
    address: String,
    message: String,
}

#[derive(Serialize)]
struct GenerateResponse {
    address: String,
    private_key: String,
    message: String,
}

#[derive(Serialize)]
struct SignResponse {
    signature: String,
    message: String,
    address: String,
}

#[derive(Serialize)]
struct AddressesResponse {
    addresses: Vec<String>,
    count: usize,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

// Enclave command types
#[derive(Serialize)]
enum EnclaveCommand {
    Keygen,
    Sign { address: String, message: String },
    List,
}

#[derive(Deserialize)]
struct EnclaveResponse {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

// Constants
const HTTP_PORT: u16 = 7777;
const VSOCK_CID: u32 = 16;
const VSOCK_PORT: u32 = 7777; // Updated to match the enclave port

async fn send_command_to_enclave(command: &EnclaveCommand) -> Result<EnclaveResponse, String> {
    let mut stream = VsockStream::connect(VSOCK_CID, VSOCK_PORT)
        .await
        .map_err(|e| format!("Failed to connect to enclave: {}", e))?;

    let json_payload = serde_json::to_string(command)
        .map_err(|e| format!("Serialization error: {}", e))?;

    stream.write_all(json_payload.as_bytes())
        .await
        .map_err(|e| format!("Write error: {}", e))?;
    
    stream.shutdown(Shutdown::Write).ok(); // signal EOF

    let mut buf = Vec::new();
    stream.read_to_end(&mut buf)
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    let response_str = String::from_utf8(buf)
        .map_err(|e| format!("UTF-8 error: {}", e))?;

    serde_json::from_str(&response_str)
        .map_err(|e| format!("JSON deserialization error: {}", e))
}

async fn generate() -> Result<ResponseJson<GenerateResponse>, (StatusCode, ResponseJson<ErrorResponse>)> {
    let command = EnclaveCommand::Keygen;
    
    match send_command_to_enclave(&command).await {
        Ok(response) => {
            if response.success {
                if let Some(data) = response.data {
                    if let (Some(address), Some(private_key)) = (
                        data["address"].as_str(),
                        data["private_key"].as_str()
                    ) {
                        let generate_response = GenerateResponse {
                            address: address.to_string(),
                            private_key: private_key.to_string(),
                            message: "Account generated and stored in enclave".to_string(),
                        };
                        Ok(ResponseJson(generate_response))
                    } else {
                        Err((
                            StatusCode::INTERNAL_SERVER_ERROR,
                            ResponseJson(ErrorResponse {
                                error: "Invalid response format from enclave".to_string(),
                            }),
                        ))
                    }
                } else {
                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        ResponseJson(ErrorResponse {
                            error: "No data in enclave response".to_string(),
                        }),
                    ))
                }
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ResponseJson(ErrorResponse {
                        error: response.error.unwrap_or_else(|| "Unknown enclave error".to_string()),
                    }),
                ))
            }
        }
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            ResponseJson(ErrorResponse { error: err }),
        )),
    }
}

async fn addresses() -> Result<ResponseJson<AddressesResponse>, (StatusCode, ResponseJson<ErrorResponse>)> {
    let command = EnclaveCommand::List;
    
    match send_command_to_enclave(&command).await {
        Ok(response) => {
            if response.success {
                if let Some(data) = response.data {
                    if let (Some(addresses), Some(count)) = (
                        data["addresses"].as_array(),
                        data["count"].as_u64()
                    ) {
                        let address_list: Vec<String> = addresses
                            .iter()
                            .filter_map(|addr| addr.as_str().map(|s| s.to_string()))
                            .collect();
                        
                        let addresses_response = AddressesResponse {
                            addresses: address_list,
                            count: count as usize,
                        };
                        Ok(ResponseJson(addresses_response))
                    } else {
                        Err((
                            StatusCode::INTERNAL_SERVER_ERROR,
                            ResponseJson(ErrorResponse {
                                error: "Invalid response format from enclave".to_string(),
                            }),
                        ))
                    }
                } else {
                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        ResponseJson(ErrorResponse {
                            error: "No data in enclave response".to_string(),
                        }),
                    ))
                }
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ResponseJson(ErrorResponse {
                        error: response.error.unwrap_or_else(|| "Unknown enclave error".to_string()),
                    }),
                ))
            }
        }
        Err(err) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            ResponseJson(ErrorResponse { error: err }),
        )),
    }
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

    let command = EnclaveCommand::Sign {
        address: payload.address.clone(),
        message: payload.message.clone(),
    };

    match send_command_to_enclave(&command).await {
        Ok(response) => {
            if response.success {
                if let Some(data) = response.data {
                    if let (Some(signature), Some(message), Some(address)) = (
                        data["signature"].as_str(),
                        data["message"].as_str(),
                        data["address"].as_str()
                    ) {
                        let sign_response = SignResponse {
                            signature: signature.to_string(),
                            message: message.to_string(),
                            address: address.to_string(),
                        };
                        Ok(ResponseJson(sign_response))
                    } else {
                        Err((
                            StatusCode::INTERNAL_SERVER_ERROR,
                            ResponseJson(ErrorResponse {
                                error: "Invalid response format from enclave".to_string(),
                            }),
                        ))
                    }
                } else {
                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        ResponseJson(ErrorResponse {
                            error: "No data in enclave response".to_string(),
                        }),
                    ))
                }
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    ResponseJson(ErrorResponse {
                        error: response.error.unwrap_or_else(|| "Unknown enclave error".to_string()),
                    }),
                ))
            }
        }
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
    
    println!("Axum relay server running on http://0.0.0.0:{}", HTTP_PORT);
    println!("Connecting to enclave on vsock CID: {}, Port: {}", VSOCK_CID, VSOCK_PORT);
    
    axum::serve(listener, app).await.unwrap();
}
