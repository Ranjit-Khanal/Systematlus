# DNS

## Concept

Before connecting to `example.com:443`, the application needs an **IP address**. DNS maps names → records (A, AAAA, CNAME, …).

## Mental model

```
Application
  → resolver (Go + OS)
    → DNS server (from /etc/resolv.conf)
      → answer (A/AAAA)
        → TCP connect to IP
```

## Real Linux behavior

| Source | What |
|---|---|
| `/etc/resolv.conf` | Configured nameservers |
| `net.Resolver.LookupIP` | REAL lookup via system resolver |
| `dig` (optional) | TTL and authoritative-style answer section |

Repeat lookups may be faster due to **caching** in systemd-resolved or libc — that is REAL, not simulated.

## Experiment

Lab → DNS → enter a domain → **RUN**. Default: `example.com`.

## Why it matters

“DNS is slow”, “wrong region”, “NXDOMAIN vs timeout”, and service mesh split-horizon DNS are operational DNS problems.
