// Backend logic for the server - parse commands and call the appropriate functions

pub fn parse_command(command: &str) -> Result<(), String> {
    match command {
        "hello" => {
            println!("Hello, world!");
            Ok(())
        }
        "keygen" => {
            println!("Keygen command received");
            Ok(())
        }
        _ => Err(format!("Unknown command: {}", command)),
    }
}