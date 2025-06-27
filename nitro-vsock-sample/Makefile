# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

ARCH := $(shell uname -m)
RUST_DIR := $(shell readlink -m $(shell dirname $(firstword $(MAKEFILE_LIST))))

DOWNLOAD_RUST := 0

build:
ifeq ($(DOWNLOAD_RUST), 1)
	curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
	rustup target install ${ARCH}-unknown-linux-musl
endif
	cargo build --manifest-path=${RUST_DIR}/Cargo.toml --target=${ARCH}-unknown-linux-musl --release
	cp ${RUST_DIR}/target/${ARCH}-unknown-linux-musl/release/vsock-sample ${RUST_DIR}


server: build
	docker build -t vsock-sample-server -f Dockerfile.server .
	nitro-cli build-enclave --docker-uri vsock-sample-server --output-file vsock_sample_server.eif

client: build
	docker build -t vsock-sample-client -f Dockerfile.client .
	nitro-cli build-enclave --docker-uri vsock-sample-client --output-file vsock_sample_client.eif

run-client: build
	./vsock-sample client --cid 18 --port 7777

.PHONY: clean
clean:
	rm -rf ${RUST_DIR}/target ${RUST_DIR}/vsock_sample_*.eif ${RUST_DIR}/server ${RUST_DIR}/client

enclave: server
	nitro-cli run-enclave --eif-path vsock_sample_server.eif --cpu-count 2 --memory 256 --debug-mode

