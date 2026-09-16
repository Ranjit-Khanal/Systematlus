// Database experiment: local HTTP handler backed by SQLite with REAL query timings.
package main

import (
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
	time.Sleep(600 * time.Millisecond)
}

func ms(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000.0
}

func main() {
	dbPath := fmt.Sprintf("%s/syslab-db-%d.sqlite", os.TempDir(), os.Getpid())
	defer os.Remove(dbPath)

	emit(fmt.Sprintf("PID=%d", os.Getpid()))
	emit("DB_DRIVER=sqlite")
	emit(fmt.Sprintf("DB_PATH=%s", dbPath))

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open db: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()
	db.SetMaxOpenConns(2)

	phase("setup")

	createStart := time.Now()
	if _, err := db.Exec(`CREATE TABLE users (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL
	)`); err != nil {
		fmt.Fprintf(os.Stderr, "create: %v\n", err)
		os.Exit(1)
	}
	emit(fmt.Sprintf("DB_EXEC op=create_table duration_ms=%.3f", ms(time.Since(createStart))))

	seedStart := time.Now()
	for _, u := range []struct {
		id   int
		name string
	}{{1, "ada"}, {2, "linus"}} {
		if _, err := db.Exec("INSERT INTO users (id, name) VALUES (?, ?)", u.id, u.name); err != nil {
			fmt.Fprintf(os.Stderr, "insert: %v\n", err)
			os.Exit(1)
		}
	}
	emit(fmt.Sprintf("DB_EXEC op=seed duration_ms=%.3f rows=2", ms(time.Since(seedStart))))

	if st, err := os.Stat(dbPath); err == nil {
		emit(fmt.Sprintf("DB_FILE_BYTES=%d", st.Size()))
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	emit(fmt.Sprintf("PORT=%d", port))
	emit(fmt.Sprintf("URL=http://127.0.0.1:%d/api/users", port))

	mux := http.NewServeMux()
	mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
		handlerStart := time.Now()
		emit(fmt.Sprintf("HANDLER_START method=%s path=%s remote=%s", r.Method, r.URL.Path, r.RemoteAddr))

		qStart := time.Now()
		rows, err := db.Query("SELECT id, name FROM users ORDER BY id")
		if err != nil {
			emit(fmt.Sprintf("DB_ERROR query=%v", err))
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
			if err := rows.Scan(&u.ID, &u.Name); err != nil {
				_ = rows.Close()
				http.Error(w, err.Error(), 500)
				return
			}
			users = append(users, u)
		}
		_ = rows.Close()
		queryMs := ms(time.Since(qStart))
		emit(fmt.Sprintf("DB_QUERY sql=SELECT id,name FROM users ORDER BY id duration_ms=%.3f rows=%d", queryMs, len(users)))

		stats := db.Stats()
		emit(fmt.Sprintf("DB_POOL open=%d in_use=%d idle=%d max_open=%d", stats.OpenConnections, stats.InUse, stats.Idle, stats.MaxOpenConnections))

		body, _ := json.Marshal(map[string]any{"users": users})
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Lab-DB", "sqlite")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)

		emit(fmt.Sprintf("HANDLER_DONE duration_ms=%.3f db_ms=%.3f bytes=%d", ms(time.Since(handlerStart)), queryMs, len(body)))
	})
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(ln) }()

	phase("listen")

	url := fmt.Sprintf("http://127.0.0.1:%d/api/users", port)
	emit("REQUEST_START")
	reqStart := time.Now()
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
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
	emit(fmt.Sprintf("TIMING total_ms=%.3f", ms(done.Sub(reqStart))))
	emit(fmt.Sprintf("TIMING until_headers_ms=%.3f", ms(connectDone.Sub(reqStart))))
	emit(fmt.Sprintf("TIMING body_read_ms=%.3f", ms(done.Sub(connectDone))))

	phase("response")
	_ = srv.Close()
	phase("closed")
	emit("OK=1")
}
