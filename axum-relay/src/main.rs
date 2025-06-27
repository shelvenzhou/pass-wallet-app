use std::io::{Read, Write};
use vsock::{VsockAddr, VsockStream};

fn main() {
    // Change this to the correct CID if needed (3 is usually the parent, 16 is a common enclave CID)
    let cid = 18;
    let port = 7777;
    let addr = VsockAddr::new(cid, port);

    println!("Connecting to vsock: cid={}, port={}", cid, port);
    match VsockStream::connect(&addr) {
        Ok(mut stream) => {
            let msg = b"Hello from vsock client!";
            stream.write_all(msg).expect("Failed to write to vsock");
            println!("Sent: {}", String::from_utf8_lossy(msg));

            let mut buf = [0u8; 1024];
            match stream.read(&mut buf) {
                Ok(n) if n > 0 => {
                    println!("Received: {}", String::from_utf8_lossy(&buf[..n]));
                }
                Ok(_) => println!("No response received."),
                Err(e) => println!("Failed to read from vsock: {}", e),
            }
        }
        Err(e) => {
            println!("Failed to connect to vsock: {}", e);
        }
    }
}