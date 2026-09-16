// HTTP experiment: local net/http server + client with timing and header capture.
package main

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

func emit(line string) {
	fmt.Println(line)
	_ = os.Stdout.Sync()
}

func phase(name string) {
	emit("PHASE=" + name)
	time.Sleep(600 * time.Millisecond)
}

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	emit(fmt.Sprintf("PID=%d", os.Getpid()))
	emit(fmt.Sprintf("PORT=%d", port))
	emit(fmt.Sprintf("URL=http://127.0.0.1:%d/api/users", port))

	mux := http.NewServeMux()
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		handlerStart := time.Now()
		emit(fmt.Sprintf("HANDLER_START method=%s path=%s remote=%s", r.Method, r.URL.Path, r.RemoteAddr))
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Lab-Server", "systems-lab")
		body := []byte(`{"users":[{"id":1,"name":"ada"},{"id":2,"name":"linus"}]}`)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
		emit(fmt.Sprintf("HANDLER_DONE duration_ms=%.3f bytes=%d", float64(time.Since(handlerStart).Microseconds())/1000.0, len(body)))
	})
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(ln) }()

	phase("listen")

	url := fmt.Sprintf("http://127.0.0.1:%d/api/users", port)
	emit("REQUEST_START")
	reqStart := time.Now()
	client := &http.Client{Timeout: 3 * time.Second}
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("User-Agent", "systems-lab/1.0")
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "request: %v\n", err)
		os.Exit(1)
	}
	connectDone := time.Now()
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	done := time.Now()

	emit(fmt.Sprintf("HTTP_STATUS=%d", resp.StatusCode))
	emit(fmt.Sprintf("HTTP_PROTO=%s", resp.Proto))
	emit(fmt.Sprintf("RESPONSE_BYTES=%d", len(body)))
	emit(fmt.Sprintf("REQ_HEADER_COUNT=%d", len(req.Header)))
	emit(fmt.Sprintf("RESP_HEADER_COUNT=%d", len(resp.Header)))
	for k, vals := range resp.Header {
		if k == "Content-Type" || k == "X-Lab-Server" || k == "Date" {
			emit(fmt.Sprintf("RESP_HEADER %s=%s", k, vals[0]))
		}
	}
	emit(fmt.Sprintf("TIMING total_ms=%.3f", float64(done.Sub(reqStart).Microseconds())/1000.0))
	emit(fmt.Sprintf("TIMING until_headers_ms=%.3f", float64(connectDone.Sub(reqStart).Microseconds())/1000.0))
	emit(fmt.Sprintf("TIMING body_read_ms=%.3f", float64(done.Sub(connectDone).Microseconds())/1000.0))

	phase("response")
	_ = srv.Close()
	phase("closed")
	emit("OK=1")
}
