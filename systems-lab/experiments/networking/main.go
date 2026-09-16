// Networking experiment: local HTTP server + client on 127.0.0.1. Emits PORT/PHASE for agent ss sampling.
package main

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

func phase(name string) {
	fmt.Printf("PHASE=%s\n", name)
	_ = os.Stdout.Sync()
	time.Sleep(900 * time.Millisecond)
}

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	fmt.Printf("PID=%d\n", os.Getpid())
	fmt.Printf("PORT=%d\n", port)
	fmt.Printf("ADDR=127.0.0.1:%d\n", port)
	_ = os.Stdout.Sync()

	mux := http.NewServeMux()
	mux.HandleFunc("/lab", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "systems-lab networking ok method=%s remote=%s\n", r.Method, r.RemoteAddr)
	})
	srv := &http.Server{Handler: mux}
	go func() {
		_ = srv.Serve(ln)
	}()

	phase("listen")

	// Client request while server stays up — ESTAB sockets visible to ss.
	client := &http.Client{Timeout: 2 * time.Second}
	url := fmt.Sprintf("http://127.0.0.1:%d/lab", port)

	// Hold connection briefly: custom transport with keep-alive for connected phase.
	connCh := make(chan net.Conn, 1)
	go func() {
		c, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), time.Second)
		if err != nil {
			fmt.Fprintf(os.Stderr, "dial: %v\n", err)
			close(connCh)
			return
		}
		connCh <- c
	}()
	c := <-connCh
	if c != nil {
		fmt.Printf("CLIENT_LOCAL=%s\n", c.LocalAddr())
		fmt.Printf("CLIENT_REMOTE=%s\n", c.RemoteAddr())
		_ = os.Stdout.Sync()
		phase("connected")
		_ = c.Close()
	}

	resp, err := client.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "GET: %v\n", err)
		os.Exit(1)
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	fmt.Printf("HTTP_STATUS=%d\n", resp.StatusCode)
	fmt.Printf("HTTP_BYTES=%d\n", len(body))
	_ = os.Stdout.Sync()
	phase("http_exchange")

	_ = srv.Close()
	phase("closed")

	fmt.Println("OK=1")
}
