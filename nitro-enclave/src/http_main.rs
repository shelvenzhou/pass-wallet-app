use nitro_enclave::http_client::run_http_server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port = std::env::var("HTTP_PORT")
        .unwrap_or_else(|_| "5000".to_string())
        .parse::<u16>()?;
    
    println!("Starting HTTP server on port {}", port);
    run_http_server(port).await?;
    
    Ok(())
} 