# Failures

## Concept

Not all errors look the same on the wire. A client can see:

| Class | What failed |
|---|---|
| **timeout** | Client deadline; server may still be working |
| **HTTP 5xx** | TCP + HTTP OK path; application returned an error status |
| **connection refused** | Nothing listening — failure before HTTP |
| **slow success** | 200 OK but latency is the problem |

## Real in this lab

Each fault is injected by the experiment server; the **client outcome** (status, error string, duration) is measured and labeled **REAL**.

Educational failure-class diagrams are **SIMULATION**.

## Experiment

Lab → FAILURES → **RUN — fault matrix**.

Faults exercised: `ok`, `timeout`, `500`, `slow`, `refused`.

## Why it matters

Retries, circuit breakers, and SLOs depend on distinguishing these classes. Retrying a 500 may help; retrying a refused connection after a deploy may help; blindly retrying timeouts can amplify load.
