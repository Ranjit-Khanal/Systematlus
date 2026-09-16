// Load experiment: concurrent HTTP clients against a local handler; REAL latency stats.
package main

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"sort"
	"sync"
	"sync/atomic"
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

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if p <= 0 {
		return sorted[0]
	}
	if p >= 100 {
		return sorted[len(sorted)-1]
	}
	idx := int(float64(len(sorted)-1) * p / 100.0)
	return sorted[idx]
}

func main() {
	total := 40
	concurrency := 8
	if v := os.Getenv("SYSLAB_LOAD_N"); v != "" {
		fmt.Sscanf(v, "%d", &total)
	}
	if v := os.Getenv("SYSLAB_LOAD_C"); v != "" {
		fmt.Sscanf(v, "%d", &concurrency)
	}
	if total < 1 {
		total = 1
	}
	if concurrency < 1 {
		concurrency = 1
	}
	if concurrency > total {
		concurrency = total
	}

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	emit(fmt.Sprintf("PID=%d", os.Getpid()))
	emit(fmt.Sprintf("PORT=%d", port))
	emit(fmt.Sprintf("LOAD_CONFIG n=%d concurrency=%d", total, concurrency))
	url := fmt.Sprintf("http://127.0.0.1:%d/api/work", port)
	emit(fmt.Sprintf("URL=%s", url))

	var handled atomic.Int64
	mux := http.NewServeMux()
	mux.HandleFunc("/api/work", func(w http.ResponseWriter, r *http.Request) {
		// Tiny artificial work so latency isn't only noise.
		time.Sleep(2 * time.Millisecond)
		handled.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(ln) }()

	phase("listen")

	type result struct {
		ok   bool
		ms   float64
		code int
		err  string
	}

	emit("LOAD_START")
	loadStart := time.Now()
	jobs := make(chan int, total)
	for i := 0; i < total; i++ {
		jobs <- i
	}
	close(jobs)

	results := make([]result, total)
	var wg sync.WaitGroup
	go func() {
		time.Sleep(80 * time.Millisecond)
		emit("PHASE=running")
	}()
	for w := 0; w < concurrency; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			client := &http.Client{Timeout: 3 * time.Second}
			for i := range jobs {
				start := time.Now()
				resp, err := client.Get(url)
				elapsed := ms(time.Since(start))
				if err != nil {
					results[i] = result{ok: false, ms: elapsed, err: err.Error()}
					continue
				}
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
				results[i] = result{ok: resp.StatusCode == 200, ms: elapsed, code: resp.StatusCode}
			}
		}()
	}
	wg.Wait()
	wall := time.Since(loadStart)
	emit(fmt.Sprintf("LOAD_DONE wall_ms=%.3f", ms(wall)))

	var okN, errN int
	latencies := make([]float64, 0, total)
	for _, r := range results {
		if r.ok {
			okN++
			latencies = append(latencies, r.ms)
		} else {
			errN++
		}
	}
	sort.Float64s(latencies)
	var sum float64
	for _, v := range latencies {
		sum += v
	}
	avg := 0.0
	if len(latencies) > 0 {
		avg = sum / float64(len(latencies))
	}
	rps := float64(okN) / wall.Seconds()

	emit(fmt.Sprintf("LOAD_STATS ok=%d err=%d handled=%d", okN, errN, handled.Load()))
	emit(fmt.Sprintf("LOAD_LATENCY avg_ms=%.3f p50_ms=%.3f p95_ms=%.3f p99_ms=%.3f max_ms=%.3f",
		avg, percentile(latencies, 50), percentile(latencies, 95), percentile(latencies, 99), percentile(latencies, 100)))
	emit(fmt.Sprintf("LOAD_THROUGHPUT rps=%.2f", rps))

	// Sample a few per-request lines for the timeline (not all 40).
	shown := 0
	for i, r := range results {
		if shown >= 5 {
			break
		}
		if i%8 != 0 {
			continue
		}
		if r.ok {
			emit(fmt.Sprintf("LOAD_SAMPLE i=%d status=%d duration_ms=%.3f", i, r.code, r.ms))
		} else {
			emit(fmt.Sprintf("LOAD_SAMPLE i=%d error=%s duration_ms=%.3f", i, r.err, r.ms))
		}
		shown++
	}

	phase("done")
	_ = srv.Close()
	emit("OK=1")
}
