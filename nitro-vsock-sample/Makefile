# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

ARCH := $(shell uname -m)
RUST_DIR := $(shell readlink -m $(shell dirname $(firstword $(MAKEFILE_LIST))))

DOWNLOAD_RUST := 0

build:
ifeq ($(DOWNLOAD_RUST), 1)
	curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
	rustup target install ${ARCH}-unknown-linux-musl
	cargo build --manifest-path=${RUST_DIR}/Cargo.toml --target=${ARCH}-unknown-linux-musl --release
	cp ${RUST_DIR}/target/${ARCH}-unknown-linux-musl/release/server ${RUST_DIR}
	cp ${RUST_DIR}/target/${ARCH}-unknown-linux-musl/release/client ${RUST_DIR}
else
	cargo build --manifest-path=${RUST_DIR}/Cargo.toml --release
	cp ${RUST_DIR}/target/release/server ${RUST_DIR}
	cp ${RUST_DIR}/target/release/client ${RUST_DIR}
endif

server: build
	docker build -t vsock-sample-server -f Dockerfile.server .
	nitro-cli build-enclave --docker-uri vsock-sample-server --output-file vsock_sample_server.eif

client: build
	docker build -t vsock-sample-client -f Dockerfile.client .
	nitro-cli build-enclave --docker-uri vsock-sample-client --output-file vsock_sample_client.eif

enclave:
	make server
	nitro-cli run-enclave --eif-path vsock_sample_client.eif --cpu-count 2 --memory 256 --debug-mode

.PHONY: clean
clean:
	rm -rf ${RUST_DIR}/target ${RUST_DIR}/vsock_sample_*.eif ${RUST_DIR}/server ${RUST_DIR}/client

enclave:
	make server
	nitro-cli run-enclave --eif-path vsock_sample_server.eif --cpu-count 2 --memory 256 --debug-mode

