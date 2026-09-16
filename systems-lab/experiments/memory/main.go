// Memory experiment: allocate, touch, hold, release — emits PHASE lines for the agent to sample /proc.
package main

import (
	"fmt"
	"os"
	"runtime"
	"runtime/debug"
	"time"
)

const chunkMB = 32
const chunks = 2 // 64 MiB total when held

func announce(name string) {
	fmt.Printf("PHASE=%s\n", name)
	_ = os.Stdout.Sync()
}

func holdForSample() {
	// Keep this state while the agent reads /proc.
	time.Sleep(900 * time.Millisecond)
}

func touch(b []byte) {
	page := os.Getpagesize()
	for i := 0; i < len(b); i += page {
		b[i] = byte(i)
	}
}

func main() {
	fmt.Printf("PID=%d\n", os.Getpid())
	fmt.Printf("PAGE_SIZE=%d\n", os.Getpagesize())
	_ = os.Stdout.Sync()

	announce("baseline")
	holdForSample()

	held := make([][]byte, 0, chunks)
	for i := 0; i < chunks; i++ {
		b := make([]byte, chunkMB<<20)
		held = append(held, b)
		fmt.Printf("ALLOC_MB=%d chunk=%d\n", chunkMB, i)
	}
	_ = os.Stdout.Sync()
	announce("allocate")
	// After make(): virtual size grows; RSS may stay low until pages are touched (lazy allocation).
	holdForSample()

	for i, b := range held {
		touch(b)
		fmt.Printf("TOUCHED_CHUNK=%d bytes=%d\n", i, len(b))
	}
	_ = os.Stdout.Sync()
	announce("touch")
	// After touch: page faults populate anonymous pages → RSS rises (REAL).
	holdForSample()

	sum := 0
	for _, b := range held {
		sum += int(b[0])
	}
	fmt.Printf("HOLD_CHECKSUM=%d\n", sum)
	_ = os.Stdout.Sync()
	announce("hold")
	holdForSample()

	held = nil
	runtime.GC()
	debug.FreeOSMemory()
	fmt.Println("RELEASED=1")
	_ = os.Stdout.Sync()
	announce("release")
	holdForSample()

	announce("done")
	holdForSample()
	fmt.Println("OK=1")
}
