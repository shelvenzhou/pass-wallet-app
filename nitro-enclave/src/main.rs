use clap::{App, AppSettings, Arg, SubCommand};

use nitro_enclave::command_parser::{ClientArgs, ServerArgs};
use nitro_enclave::create_app;
use nitro_enclave::{client, server};

fn main() {
    let app = create_app!();
    let args = app.get_matches();

    match args.subcommand() {
        Some(("server", args)) => {
            println!("Running in server mode");
            let server_args = ServerArgs::new_with(args).unwrap();
            server(server_args).unwrap();
        }
        Some(("client", args)) => {
            println!("Running in client mode");
            let client_args = ClientArgs::new_with(args).unwrap();
            client(client_args).unwrap();
        }
        Some(_) | None => ()
    }
}
