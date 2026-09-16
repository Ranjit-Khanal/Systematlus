package network

import (
	"context"
	"testing"
	"time"
)

func TestReadResolvConf(t *testing.T) {
	ns := ReadResolvConf()
	if len(ns) == 0 {
		t.Fatal("expected nameservers")
	}
}

func TestLookupDNSExample(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	r := LookupDNS(ctx, "example.com")
	if r.Error != "" {
		t.Fatalf("lookup failed: %s", r.Error)
	}
	if len(r.Records) == 0 {
		t.Fatal("no records")
	}
	if r.LatencyMS < 0 {
		t.Fatal("bad latency")
	}
}
