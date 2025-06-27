pub mod command_parser;
pub mod protocol_helpers;
pub mod server_logic;
pub mod utils;
pub mod http_client;

use command_parser::{ClientArgs, ServerArgs};
use protocol_helpers::{recv_loop, recv_u64, send_loop, send_u64};
use server_logic::parse_command;

use nix::sys::socket::listen as listen_vsock;
use nix::sys::socket::{accept, bind, connect, shutdown, socket};
use nix::sys::socket::{AddressFamily, Shutdown, SockAddr, SockFlag, SockType};
use nix::unistd::close;
use std::convert::TryInto;
use std::os::unix::io::{AsRawFd, RawFd};

const VMADDR_CID_ANY: u32 = 0xFFFFFFFF;
const BUF_MAX_LEN: usize = 8192;
// Maximum number of outstanding connections in the socket's
// listen queue
const BACKLOG: usize = 128;
// Maximum number of connection attempts
const MAX_CONNECTION_ATTEMPTS: usize = 5;

pub struct VsockSocket {
    socket_fd: RawFd,
    shutdown_mode: Shutdown,
}

impl VsockSocket {
    fn new(socket_fd: RawFd, shutdown_mode: Shutdown) -> Self {
        VsockSocket {
            socket_fd,
            shutdown_mode,
        }
    }
}

impl Drop for VsockSocket {
    fn drop(&mut self) {
        shutdown(self.socket_fd, self.shutdown_mode)
            .unwrap_or_else(|e| eprintln!("Failed to shut socket down: {:?}", e));
        close(self.socket_fd).unwrap_or_else(|e| eprintln!("Failed to close socket: {:?}", e));
    }
}

impl AsRawFd for VsockSocket {
    fn as_raw_fd(&self) -> RawFd {
        self.socket_fd
    }
}

/// Initiate a connection on an AF_VSOCK socket
pub fn vsock_connect(cid: u32, port: u32) -> Result<VsockSocket, String> {
    let sockaddr = SockAddr::new_vsock(cid, port);
    let mut err_msg = String::new();

    for i in 0..MAX_CONNECTION_ATTEMPTS {
        let vsocket = VsockSocket::new(
            socket(
                AddressFamily::Vsock,
                SockType::Stream,
                SockFlag::empty(),
                None,
            )
            .map_err(|err| format!("Failed to create the socket: {:?}", err))?,
            Shutdown::Write,
        );
        match connect(vsocket.as_raw_fd(), &sockaddr) {
            Ok(_) => return Ok(vsocket),
            Err(e) => err_msg = format!("Failed to connect: {}", e),
        }

        // Exponentially backoff before retrying to connect to the socket
        std::thread::sleep(std::time::Duration::from_secs(1 << i));
    }

    Err(err_msg)
}

/// Send 'Hello, world!' to the server. Entry point for the client.
pub fn client(args: ClientArgs) -> Result<(), String> {
    let vsocket = vsock_connect(args.cid, args.port)?;
    let fd = vsocket.as_raw_fd();

    // Send JSON keygen command
    let data = serde_json::json!({"Keygen": null}).to_string();
    let buf = data.as_bytes();
    let len: u64 = buf.len().try_into().map_err(|err| format!("{:?}", err))?;
    send_u64(fd, len)?;
    send_loop(fd, buf, len)?;
    println!("Sent: {}", data);

    // Wait for and receive the server's response
    let mut response_buf = [0u8; BUF_MAX_LEN];
    let response_len = recv_u64(fd)?;
    recv_loop(fd, &mut response_buf, response_len)?;
    
    let response = String::from_utf8(response_buf[..response_len as usize].to_vec())
        .map_err(|err| format!("The received bytes are not UTF-8: {:?}", err))?;
    println!("Received response: {}", response);

    Ok(())
}

/// Accept connections on a certain port and print the received data.
/// Entry point for the server.
pub fn server(args: ServerArgs) -> Result<(), String> {
    let socket_fd = socket(
        AddressFamily::Vsock,
        SockType::Stream,
        SockFlag::empty(),
        None,
    )
    .map_err(|err| format!("Create socket failed: {:?}", err))?;

    let sockaddr = SockAddr::new_vsock(VMADDR_CID_ANY, args.port);

    bind(socket_fd, &sockaddr).map_err(|err| format!("Bind failed: {:?}", err))?;

    listen_vsock(socket_fd, BACKLOG).map_err(|err| format!("Listen failed: {:?}", err))?;

    println!("Server listening on port {}", args.port);

    loop {
        let vsocket = match accept(socket_fd) {
            Ok(fd) => VsockSocket::new(fd, Shutdown::Read),
            Err(e) => {
                eprintln!("Accept failed: {:?}", e);
                continue;
            }
        };
        
        let fd = vsocket.as_raw_fd();
        println!("Accepted connection on fd {}", fd);

        // Handle each connection in a separate scope to ensure proper cleanup
        let result = handle_connection(fd);
        if let Err(e) = result {
            eprintln!("Error handling connection: {}", e);
        }
        
        // vsocket will be automatically dropped here, closing the connection
    }
}

fn handle_connection(fd: RawFd) -> Result<(), String> {
    // Receive data from client
    let mut buf = [0u8; BUF_MAX_LEN];
    let len = recv_u64(fd)?;
    recv_loop(fd, &mut buf, len)?;
    
    let received_data = String::from_utf8(buf[..len as usize].to_vec())
        .map_err(|err| format!("The received bytes are not UTF-8: {:?}", err))?;
    
    println!("Received: {}", received_data);

    // Parse and execute command
    let result = parse_command(&received_data);
    
    // Send result back to client
    let response = match result {
        Ok(response) => serde_json::to_string(&response)
            .map_err(|err| format!("Failed to serialize response: {:?}", err))?,
        Err(e) => serde_json::to_string(&server_logic::Response {
            success: false,
            data: None,
            error: Some(e),
        }).map_err(|err| format!("Failed to serialize error response: {:?}", err))?,
    };
    
    let response_bytes = response.as_bytes();
    let response_len: u64 = response_bytes.len().try_into().map_err(|err| format!("{:?}", err))?;
    send_u64(fd, response_len)?;
    send_loop(fd, response_bytes, response_len)?;
    
    println!("Sent response: {}", response);
    Ok(())
}
