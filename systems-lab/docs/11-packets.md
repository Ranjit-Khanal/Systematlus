# Packets

## Concept

Above TCP connection state (`ss`) sits the wire: **IP packets** carrying TCP segments. `tcpdump` (or AF_PACKET) reads those frames from an interface.

## Mental model

```
write() / send
  → TCP segment (flags, seq, ack)
    → IP packet
      → loopback / NIC
        → tcpdump (needs CAP_NET_RAW)
```

## Real vs blocked on this host

| Case | Label |
|---|---|
| `tcpdump` opens `lo` and prints lines | **REAL** packet events |
| Permission denied / missing binary | **REAL** “capture BLOCKED” status + install hint |
| Educational SYN → SYN-ACK → … table when blocked | **SIMULATION** only |
| `ss` socket rows during the same exchange | **REAL** (unchanged) |

This lab **never invents** sequence numbers or frame bytes when capture fails.

## Enable capture (optional)

```bash
# capability on the binary (preferred for labs):
sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)

# or run the agent with privileges (not required for other experiments)
```

## Experiment

Lab → PACKETS → **RUN — TCP + packet capture**.

Reuses the TCP client/server exchange; starts `tcpdump -i lo -n tcp port <N>` when capability allows.

## Why it matters

“Handshake” in diagrams is abstract until you see Flags `[S]` / `[S.]` / `[.]` on the wire. Ops debugging (retransmits, MTU, resets) starts here.
