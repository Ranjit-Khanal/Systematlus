package network

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
	"time"
)

// DNSRecord is one resolved record (REAL).
type DNSRecord struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Value string `json:"value"`
	TTL   int    `json:"ttl,omitempty"`
}

// DNSResult is a REAL DNS lookup result.
type DNSResult struct {
	Domain       string      `json:"domain"`
	Nameservers  []string    `json:"nameservers"`
	Records      []DNSRecord `json:"records"`
	LatencyMS    float64     `json:"latency_ms"`
	Method       string      `json:"method"`
	ResolverNote string      `json:"resolver_note,omitempty"`
	Error        string      `json:"error,omitempty"`
}

// ReadResolvConf parses nameserver lines from /etc/resolv.conf (REAL).
func ReadResolvConf() []string {
	f, err := os.Open("/etc/resolv.conf")
	if err != nil {
		return nil
	}
	defer f.Close()
	var ns []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if strings.HasPrefix(line, "nameserver ") {
			ns = append(ns, strings.TrimSpace(strings.TrimPrefix(line, "nameserver")))
		}
	}
	return ns
}

// LookupDNS performs a REAL lookup via Go's resolver (uses system libc/resolv.conf).
func LookupDNS(ctx context.Context, domain string) DNSResult {
	start := time.Now()
	r := DNSResult{
		Domain:      domain,
		Nameservers: ReadResolvConf(),
		Method:      "go/net.Resolver (system resolver)",
		ResolverNote: "Go calls the OS resolver (typically systemd-resolved or /etc/resolv.conf). This is REAL, not simulated.",
	}
	ips, err := net.DefaultResolver.LookupIP(ctx, "ip", domain)
	r.LatencyMS = float64(time.Since(start).Microseconds()) / 1000.0
	if err != nil {
		r.Error = err.Error()
		return r
	}
	seen := map[string]bool{}
	for _, ip := range ips {
		typ := "A"
		if ip.To4() == nil {
			typ = "AAAA"
		}
		val := ip.String()
		key := typ + "|" + val
		if seen[key] {
			continue
		}
		seen[key] = true
		r.Records = append(r.Records, DNSRecord{Name: domain, Type: typ, Value: val})
	}
	// Enrich with dig TTL when available (optional REAL detail).
	if digRecs, err := DigA(domain); err == nil && len(digRecs) > 0 {
		r.Method = "go/net.Resolver + dig (TTL)"
		for i := range r.Records {
			for _, d := range digRecs {
				if r.Records[i].Type == d.Type && r.Records[i].Value == d.Value {
					r.Records[i].TTL = d.TTL
				}
			}
		}
	}
	return r
}

// DigA runs `dig +noall +answer` when dig is installed (REAL).
func DigA(domain string) ([]DNSRecord, error) {
	if _, err := exec.LookPath("dig"); err != nil {
		return nil, err
	}
	out, err := exec.Command("dig", "+noall", "+answer", domain, "A").Output()
	if err != nil {
		return nil, err
	}
	var recs []DNSRecord
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		ttl, _ := parseInt(fields[1])
		recs = append(recs, DNSRecord{
			Name: fields[0], TTL: ttl, Type: fields[3], Value: fields[4],
		})
	}
	return recs, nil
}

func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
