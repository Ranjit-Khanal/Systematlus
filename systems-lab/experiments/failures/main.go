// Failures experiment: controlled HTTP faults with REAL client outcomes.
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
	time.Sleep(400 * time.Millisecond)
}

func ms(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000.0
}

func doRequest(client *http.Client, url, fault string) {
	emit(fmt.Sprintf("FAULT_INJECT fault=%s", fault))
	start := time.Now()
	req, _ := http.NewRequest(http.MethodGet, url+"?fault="+fault, nil)
	resp, err := client.Do(req)
	elapsed := time.Since(start)
	if err != nil {
		emit(fmt.Sprintf("FAULT_RESULT fault=%s outcome=error duration_ms=%.3f err=%v", fault, ms(elapsed), err))
		return
	}
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	emit(fmt.Sprintf("FAULT_RESULT fault=%s outcome=http status=%d duration_ms=%.3f bytes=%d",
		fault, resp.StatusCode, ms(elapsed), len(body)))
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
	base := fmt.Sprintf("http://127.0.0.1:%d/api/work", port)
	emit(fmt.Sprintf("URL=%s", base))

	mux := http.NewServeMux()
	mux.HandleFunc("/api/work", func(w http.ResponseWriter, r *http.Request) {
		fault := r.URL.Query().Get("fault")
		emit(fmt.Sprintf("HANDLER_START fault=%s remote=%s", fault, r.RemoteAddr))
		switch fault {
		case "timeout":
			time.Sleep(800 * time.Millisecond) // client timeout is 200ms
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"ok":true,"fault":"timeout"}`))
		case "500":
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"ok":false,"fault":"500"}`))
		case "slow":
			time.Sleep(250 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"ok":true,"fault":"slow"}`))
		default: // ok
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"ok":true,"fault":"ok"}`))
		}
		emit(fmt.Sprintf("HANDLER_DONE fault=%s", fault))
	})
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(ln) }()

	phase("listen")

	fast := &http.Client{Timeout: 200 * time.Millisecond}
	normal := &http.Client{Timeout: 2 * time.Second}

	phase("ok")
	doRequest(normal, base, "ok")

	phase("timeout")
	doRequest(fast, base, "timeout")

	phase("http_500")
	doRequest(normal, base, "500")

	phase("slow")
	doRequest(normal, base, "slow")

	phase("refused")
	_ = srv.Close()
	time.Sleep(100 * time.Millisecond)
	emit("FAULT_INJECT fault=refused")
	start := time.Now()
	_, err = normal.Get(base + "?fault=refused")
	elapsed := time.Since(start)
	if err != nil {
		emit(fmt.Sprintf("FAULT_RESULT fault=refused outcome=error duration_ms=%.3f err=%v", ms(elapsed), err))
	} else {
		emit(fmt.Sprintf("FAULT_RESULT fault=refused outcome=unexpected_ok duration_ms=%.3f", ms(elapsed)))
	}

	phase("done")
	emit("OK=1")
}
