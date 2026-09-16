// E2E experiment: one GET /api/users crossing DNS → TCP → HTTP → SQLite on loopback.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"

	_ "modernc.org/sqlite"
)

func emit(line string) {
	fmt.Println(line)
	_ = os.Stdout.Sync()
}

func phase(name string) {
	emit("PHASE=" + name)
	time.Sleep(500 * time.Millisecond)
}

func ms(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000.0
}

func main() {
	domain := "localhost"
	if v := os.Getenv("SYSLAB_E2E_DOMAIN"); v != "" {
		domain = v
	}

	emit(fmt.Sprintf("PID=%d", os.Getpid()))
	emit(fmt.Sprintf("DOMAIN=%s", domain))
	emit("TARGET_PATH=/api/users")

	phase("dns")
	dnsStart := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", domain)
	cancel()
	dnsMs := ms(time.Since(dnsStart))
	if err != nil {
		emit(fmt.Sprintf("DNS_ERROR err=%v duration_ms=%.3f", err, dnsMs))
		fmt.Fprintf(os.Stderr, "dns: %v\n", err)
		os.Exit(1)
	}
	var addrs []string
	for _, ip := range ips {
		addrs = append(addrs, ip.String())
	}
	emit(fmt.Sprintf("DNS_RESULT addrs=%s duration_ms=%.3f", join(addrs), dnsMs))
	emit(fmt.Sprintf("STEP layer=dns action=lookup domain=%s duration_ms=%.3f addrs=%d", domain, dnsMs, len(addrs)))

	targetIP := "127.0.0.1"
	for _, a := range addrs {
		if a == "127.0.0.1" {
			targetIP = a
			break
		}
		if ip := net.ParseIP(a); ip != nil && ip.To4() != nil && targetIP == "127.0.0.1" {
			targetIP = a
		}
	}
	emit(fmt.Sprintf("RESOLVED_IP=%s", targetIP))

	dbPath := fmt.Sprintf("%s/syslab-e2e-%d.sqlite", os.TempDir(), os.Getpid())
	defer os.Remove(dbPath)
	emit(fmt.Sprintf("DB_PATH=%s", dbPath))

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	phase("setup")
	if _, err := db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)`); err != nil {
		fmt.Fprintf(os.Stderr, "create: %v\n", err)
		os.Exit(1)
	}
	for _, u := range []struct {
		id   int
		name string
	}{{1, "ada"}, {2, "linus"}} {
		if _, err := db.Exec("INSERT INTO users (id, name) VALUES (?, ?)", u.id, u.name); err != nil {
			fmt.Fprintf(os.Stderr, "insert: %v\n", err)
			os.Exit(1)
		}
	}
	emit("DB_EXEC op=seed rows=2")

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	url := fmt.Sprintf("http://127.0.0.1:%d/api/users", port)
	emit(fmt.Sprintf("PORT=%d", port))
	emit(fmt.Sprintf("URL=%s", url))

	var handlerDBMs float64
	mux := http.NewServeMux()
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		handlerStart := time.Now()
		emit(fmt.Sprintf("HANDLER_START method=%s path=%s", r.Method, r.URL.Path))

		qStart := time.Now()
		rows, err := db.Query("SELECT id, name FROM users ORDER BY id")
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		type user struct {
			ID   int    `json:"id"`
			Name string `json:"name"`
		}
		var users []user
		for rows.Next() {
			var u user
			_ = rows.Scan(&u.ID, &u.Name)
			users = append(users, u)
		}
		_ = rows.Close()
		queryMs := ms(time.Since(qStart))
		handlerDBMs = queryMs
		emit(fmt.Sprintf("DB_QUERY sql=SELECT id,name FROM users ORDER BY id duration_ms=%.3f rows=%d", queryMs, len(users)))
		emit(fmt.Sprintf("STEP layer=db action=query duration_ms=%.3f rows=%d", queryMs, len(users)))

		body, _ := json.Marshal(map[string]any{"users": users})
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Lab-E2E", "1")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
		emit(fmt.Sprintf("HANDLER_DONE duration_ms=%.3f db_ms=%.3f bytes=%d", ms(time.Since(handlerStart)), queryMs, len(body)))
		emit(fmt.Sprintf("STEP layer=http action=handler duration_ms=%.3f bytes=%d", ms(time.Since(handlerStart)), len(body)))
	})
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(ln) }()

	phase("listen")

	emit("REQUEST_START")
	reqStart := time.Now()
	client := &http.Client{Timeout: 5 * time.Second}

	dialStart := time.Now()
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 2*time.Second)
	if err != nil {
		fmt.Fprintf(os.Stderr, "dial: %v\n", err)
		os.Exit(1)
	}
	tcpMs := ms(time.Since(dialStart))
	emit(fmt.Sprintf("TCP_CONNECT local=%s remote=%s duration_ms=%.3f", conn.LocalAddr(), conn.RemoteAddr(), tcpMs))
	emit(fmt.Sprintf("STEP layer=tcp action=connect duration_ms=%.3f", tcpMs))
	_ = conn.Close()

	resp, err := client.Get(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "get: %v\n", err)
		os.Exit(1)
	}
	headersMs := ms(time.Since(reqStart))
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	done := time.Now()
	totalMs := ms(done.Sub(reqStart))
	bodyMs := ms(done.Sub(reqStart)) - headersMs
	if bodyMs < 0 {
		bodyMs = 0
	}

	emit(fmt.Sprintf("HTTP_STATUS=%d", resp.StatusCode))
	emit(fmt.Sprintf("HTTP_PROTO=%s", resp.Proto))
	emit(fmt.Sprintf("RESPONSE_BYTES=%d", len(body)))
	emit(fmt.Sprintf("STEP layer=http action=response status=%d duration_ms=%.3f bytes=%d", resp.StatusCode, totalMs, len(body)))

	phase("response")
	emit(fmt.Sprintf("TIMING dns_ms=%.3f tcp_ms=%.3f http_ms=%.3f db_ms=%.3f total_ms=%.3f",
		dnsMs, tcpMs, totalMs, handlerDBMs, totalMs+dnsMs))
	emit(fmt.Sprintf("E2E_SUMMARY domain=%s status=%d dns_ms=%.3f tcp_ms=%.3f http_ms=%.3f db_ms=%.3f total_ms=%.3f",
		domain, resp.StatusCode, dnsMs, tcpMs, totalMs, handlerDBMs, totalMs+dnsMs))

	_ = srv.Close()
	phase("done")
	emit("OK=1")
}

func join(ss []string) string {
	if len(ss) == 0 {
		return ""
	}
	out := ss[0]
	for i := 1; i < len(ss); i++ {
		out += "," + ss[i]
	}
	return out
}
