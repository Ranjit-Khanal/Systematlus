# HTTP

## Concept

HTTP runs **on top of TCP**. A client sends a request line + headers; the server routes to a handler and returns status + headers + body.

## Mental model

```
http.Client.Do()
  → TCP connection
    → net/http server
      → ServeMux matches path
        → handler writes ResponseWriter
```

## Real in this lab

| Item | Source |
|---|---|
| Status code, protocol | Experiment stdout |
| Response headers | Captured from `*http.Response` |
| Handler duration | Measured in handler |
| Client timings | Measured around `client.Do` |
| TCP sockets during request | `ss` sample (REAL) |

Stack diagrams in the UI are SIMULATION cues.

## Experiment

Lab → HTTP → **RUN — GET /api/users**.

## Why it matters

Latency lives in DNS + TCP + TLS + HTTP + handler + DB. This lab isolates the HTTP layer on loopback so you can see handler vs wire time.
