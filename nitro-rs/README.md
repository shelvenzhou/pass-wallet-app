## AWS Nitro Deployment

See Nitro Rust Tutorial [here](https://docs.aws.amazon.com/enclaves/latest/user/developing-applications-linux.html)

Build onto AWS m5.xlarge instance

```bash
rustup target add x86_64-unknown-linux-musl
cargo build --target=x86_64-unknown-linux-musl --release
docker build -t nitro-rs .
nitro-cli build-enclave --docker-dir ./ --docker-uri nitro-rs --output-file nitro-rs.eif
```



