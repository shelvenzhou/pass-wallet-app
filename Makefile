# Pass Wallet App - Prototype Server Management
# HTTP Server (port 5000) + Next.js Server (port 3000)

HTTP_PORT = 5000
NEXTJS_PORT = 3000

.PHONY: start list stop help

help:
	@echo "Available commands:"
	@echo "  start  - Start both servers in background"
	@echo "  list   - Show running servers"
	@echo "  stop   - Stop both servers"

start:
	@echo "Starting servers on port $(HTTP_PORT) and $(NEXTJS_PORT)..."
	@cd nitro-enclave && nohup cargo run --bin http-server > ../http-server.log 2>&1 & echo $$! > ../http-server.pid.log
	@nohup npm run dev > nextjs-dev.log 2>&1 & echo $$! > nextjs.pid.log
	@sleep 3
	@echo "Servers started. Use 'make list' to check status."

list:
	@echo "Running servers:"
	@sudo ss -tulnp | grep -E ":($(HTTP_PORT)|$(NEXTJS_PORT)) " || echo "No servers found on ports $(HTTP_PORT) or $(NEXTJS_PORT)"

stop:
	@echo "Stopping servers..."
	@if [ -f http-server.pid.log ]; then kill $$(cat http-server.pid.log) 2>/dev/null && rm -f http-server.pid.log; fi
	@if [ -f nextjs.pid.log ]; then kill $$(cat nextjs.pid.log) 2>/dev/null && rm -f nextjs.pid.log; fi
	@for port in $(HTTP_PORT) $(NEXTJS_PORT); do \
		PID=$$(sudo ss -tulnp | grep ":$$port " | head -1 | sed -n 's/.*pid=\([0-9]*\).*/\1/p'); \
		if [ ! -z "$$PID" ]; then kill -9 $$PID 2>/dev/null; fi; \
	done
	@echo "Servers stopped."