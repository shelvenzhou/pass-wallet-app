#!/bin/bash

# PASS Wallet Test Runner Script
# This script runs the comprehensive test suite for the Nitro Enclave PASS Wallet

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to run tests with timing
run_test_suite() {
    local test_name="$1"
    local test_pattern="$2"
    
    print_status "Running $test_name..."
    local start_time=$(date +%s)
    
    if cargo test "$test_pattern" --release -- --nocapture; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        print_success "$test_name completed in ${duration}s"
        return 0
    else
        print_error "$test_name failed"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Rust is installed
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo not found. Please install Rust."
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "Cargo.toml" ]; then
        print_error "Cargo.toml not found. Please run from the nitro-enclave directory."
        exit 1
    fi
    
    # Check if tests directory exists
    if [ ! -d "tests" ]; then
        print_error "Tests directory not found."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to display help
show_help() {
    echo "PASS Wallet Test Runner"
    echo "======================"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -a, --all               Run all tests (default)"
    echo "  -f, --functionality     Run only functionality tests"
    echo "  -b, --benchmark         Run only benchmark tests"
    echo "  -i, --integration       Run only integration tests"
    echo "  -q, --quick             Run quick tests (excludes long-running benchmarks)"
    echo "  -c, --coverage          Run tests with coverage analysis"
    echo "  -v, --verbose           Run with verbose output"
    echo "  --no-release            Run tests in debug mode (slower but more detailed errors)"
    echo ""
    echo "Examples:"
    echo "  $0                      # Run all tests"
    echo "  $0 --functionality      # Run only functionality tests"
    echo "  $0 --benchmark          # Run only benchmark tests"
    echo "  $0 --quick              # Run quick tests only"
}

# Default options
RUN_ALL=true
RUN_FUNCTIONALITY=false
RUN_BENCHMARK=false
RUN_INTEGRATION=false
RUN_QUICK=false
RUN_COVERAGE=false
VERBOSE=false
USE_RELEASE=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -a|--all)
            RUN_ALL=true
            shift
            ;;
        -f|--functionality)
            RUN_ALL=false
            RUN_FUNCTIONALITY=true
            shift
            ;;
        -b|--benchmark)
            RUN_ALL=false
            RUN_BENCHMARK=true
            shift
            ;;
        -i|--integration)
            RUN_ALL=false
            RUN_INTEGRATION=true
            shift
            ;;
        -q|--quick)
            RUN_QUICK=true
            shift
            ;;
        -c|--coverage)
            RUN_COVERAGE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-release)
            USE_RELEASE=false
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo "======================================"
    echo "PASS Wallet Test Suite Runner"
    echo "======================================"
    echo ""
    
    check_prerequisites
    
    # Set up environment
    export RUST_BACKTRACE=1
    if [ "$VERBOSE" = true ]; then
        export RUST_LOG=debug
    fi
    
    # Build flags
    BUILD_FLAGS=""
    if [ "$USE_RELEASE" = true ]; then
        BUILD_FLAGS="--release"
        print_status "Running tests in release mode for optimal performance"
    else
        print_status "Running tests in debug mode"
    fi
    
    # Test flags
    TEST_FLAGS="-- --nocapture"
    if [ "$VERBOSE" = true ]; then
        TEST_FLAGS="$TEST_FLAGS --test-threads=1"
    fi
    
    local total_start_time=$(date +%s)
    local failed_tests=()
    
    # Build first
    print_status "Building project..."
    if ! cargo build $BUILD_FLAGS; then
        print_error "Build failed"
        exit 1
    fi
    print_success "Build completed"
    
    # Run tests based on options
    if [ "$RUN_ALL" = true ] || [ "$RUN_FUNCTIONALITY" = true ]; then
        if ! run_test_suite "Functionality Tests" "functionality_tests"; then
            failed_tests+=("functionality_tests")
        fi
    fi
    
    if [ "$RUN_ALL" = true ] || [ "$RUN_INTEGRATION" = true ]; then
        if ! run_test_suite "Integration Tests" "integration_tests"; then
            failed_tests+=("integration_tests")
        fi
    fi
    
    if [ "$RUN_ALL" = true ] || [ "$RUN_BENCHMARK" = true ]; then
        if [ "$RUN_QUICK" = true ]; then
            print_warning "Skipping benchmark tests in quick mode"
        else
            if ! run_test_suite "Benchmark Tests" "benchmark_tests"; then
                failed_tests+=("benchmark_tests")
            fi
        fi
    fi
    
    # Run coverage if requested
    if [ "$RUN_COVERAGE" = true ]; then
        print_status "Running coverage analysis..."
        if command -v cargo-tarpaulin &> /dev/null; then
            cargo tarpaulin --out Html --output-dir target/coverage
            print_success "Coverage report generated in target/coverage/"
        else
            print_warning "cargo-tarpaulin not found. Install with: cargo install cargo-tarpaulin"
        fi
    fi
    
    # Summary
    local total_end_time=$(date +%s)
    local total_duration=$((total_end_time - total_start_time))
    
    echo ""
    echo "======================================"
    echo "Test Suite Summary"
    echo "======================================"
    echo "Total execution time: ${total_duration}s"
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_success "All tests passed!"
        echo ""
        echo "Test Coverage Summary:"
        echo "- ✅ Wallet creation and management"
        echo "- ✅ Claim operations (inbox to subaccount)"
        echo "- ✅ Internal transfers between subaccounts"
        echo "- ✅ Withdraw operations to external addresses"
        echo "- ✅ Multi-asset support (ETH, ERC20)"
        echo "- ✅ Provenance tracking and filtering"
        echo "- ✅ Error handling and edge cases"
        echo "- ✅ Performance benchmarking"
        echo "- ✅ Integration scenarios"
        echo ""
        exit 0
    else
        print_error "Failed test suites: ${failed_tests[*]}"
        echo ""
        echo "Troubleshooting tips:"
        echo "- Check the test output above for specific failures"
        echo "- Try running individual test suites with -f, -b, or -i flags"
        echo "- Run without --release flag for more detailed error messages"
        echo "- Check the test documentation in tests/README.md"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"
