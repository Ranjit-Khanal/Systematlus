// DNS experiment: resolve a domain using the system resolver and print REAL results.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/hecker/systematlus/systems-lab/internal/network"
)

func emit(line string) {
	fmt.Println(line)
	_ = os.Stdout.Sync()
}

func main() {
	domain := "example.com"
	if len(os.Args) > 1 && os.Args[1] != "" {
		domain = os.Args[1]
	}
	emit(fmt.Sprintf("PID=%d", os.Getpid()))
	emit(fmt.Sprintf("DOMAIN=%s", domain))
	emit("PHASE=lookup")

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	res := network.LookupDNS(ctx, domain)

	for _, ns := range res.Nameservers {
		emit(fmt.Sprintf("NAMESERVER=%s", ns))
	}
	emit(fmt.Sprintf("LATENCY_MS=%.3f", res.LatencyMS))
	emit(fmt.Sprintf("METHOD=%s", res.Method))
	if res.Error != "" {
		emit(fmt.Sprintf("ERROR=%s", res.Error))
		os.Exit(1)
	}
	for _, rec := range res.Records {
		emit(fmt.Sprintf("RECORD type=%s value=%s ttl=%d", rec.Type, rec.Value, rec.TTL))
	}
	emit("OK=1")
}
