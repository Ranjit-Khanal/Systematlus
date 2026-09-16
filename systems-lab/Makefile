.PHONY: dev build build-agent build-experiments test web-install clean tidy verify

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BIN := $(ROOT)/bin
AGENT := $(BIN)/agent
WEB := $(ROOT)/apps/web

export SYSLAB_BIN := $(BIN)
export SYSLAB_ADDR := :8080
export SYSLAB_CORS := http://localhost:5174

dev: build-experiments build-agent web-install
	@chmod +x $(ROOT)/scripts/dev.sh
	@$(ROOT)/scripts/dev.sh

build: build-experiments build-agent
	cd $(WEB) && npm run build

build-agent:
	@mkdir -p $(BIN)
	cd $(ROOT) && go build -o $(AGENT) ./apps/agent

build-experiments:
	@mkdir -p $(BIN)
	cd $(ROOT) && go build -o $(BIN)/exp-processes ./experiments/processes
	cd $(ROOT) && go build -o $(BIN)/exp-syscalls ./experiments/syscalls
	cd $(ROOT) && go build -o $(BIN)/exp-memory ./experiments/memory
	cd $(ROOT) && go build -o $(BIN)/exp-scheduler ./experiments/scheduler
	cd $(ROOT) && go build -o $(BIN)/exp-networking ./experiments/networking
	cd $(ROOT) && go build -o $(BIN)/exp-tcp ./experiments/tcp
	cd $(ROOT) && go build -o $(BIN)/exp-dns ./experiments/dns
	cd $(ROOT) && go build -o $(BIN)/exp-http ./experiments/http
	cd $(ROOT) && go build -o $(BIN)/exp-database ./experiments/database
	cd $(ROOT) && go build -o $(BIN)/exp-failures ./experiments/failures
	cd $(ROOT) && go build -o $(BIN)/exp-load ./experiments/load
	cd $(ROOT) && go build -o $(BIN)/exp-e2e ./experiments/e2e

test:
	cd $(ROOT) && go test ./internal/...

tidy:
	cd $(ROOT) && go mod tidy

web-install:
	cd $(WEB) && npm install

verify: test build-experiments build-agent
	@$(AGENT) & echo $$! > $(BIN)/agent.pid; \
	sleep 0.4; \
	curl -sf http://127.0.0.1:8080/api/health >/dev/null; \
	curl -sf http://127.0.0.1:8080/api/tools >/dev/null; \
	curl -sf http://127.0.0.1:8080/api/network >/dev/null; \
	curl -sf http://127.0.0.1:8080/api/observability >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/process/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/syscalls/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/memory/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/scheduler/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/network/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/tcp/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/dns/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/http/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/database/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/packets/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/failures/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/load/run >/dev/null; \
	curl -sf -X POST http://127.0.0.1:8080/api/experiments/e2e/run >/dev/null; \
	kill `cat $(BIN)/agent.pid` 2>/dev/null || true; \
	rm -f $(BIN)/agent.pid; \
	echo "verify OK"

clean:
	rm -rf $(BIN) $(WEB)/dist $(WEB)/node_modules
