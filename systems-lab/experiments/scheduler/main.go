// Scheduler experiment: many goroutines on few OS threads. Emits metrics then PHASE for the agent.
package main

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

func emitRuntime() {
	fmt.Printf("GOROUTINES=%d\n", runtime.NumGoroutine())
	fmt.Printf("GOMAXPROCS=%d\n", runtime.GOMAXPROCS(0))
	fmt.Printf("NUM_CPU=%d\n", runtime.NumCPU())
	_ = os.Stdout.Sync()
}

// phase emits runtime metrics first so the agent has fresh GOROUTINES= before PHASE=.
func phase(name string) {
	emitRuntime()
	fmt.Printf("PHASE=%s\n", name)
	_ = os.Stdout.Sync()
	time.Sleep(1100 * time.Millisecond)
}

func main() {
	fmt.Printf("PID=%d\n", os.Getpid())
	runtime.GOMAXPROCS(2)
	_ = os.Stdout.Sync()

	phase("baseline")

	const nSleep = 80
	stopSleep := make(chan struct{})
	var sleepWG sync.WaitGroup
	sleepWG.Add(nSleep)
	for i := 0; i < nSleep; i++ {
		go func() {
			defer sleepWG.Done()
			<-stopSleep
		}()
	}
	// Yield so spawned goroutines are runnable/counted before we sample.
	runtime.Gosched()
	time.Sleep(50 * time.Millisecond)
	phase("many_goroutines")

	const nBusy = 40
	var stopBusy atomic.Bool
	var busyWG sync.WaitGroup
	busyWG.Add(nBusy)
	for i := 0; i < nBusy; i++ {
		go func() {
			defer busyWG.Done()
			x := 0
			for !stopBusy.Load() {
				x++
				if x%10007 == 0 {
					runtime.Gosched()
				}
			}
			_ = x
		}()
	}
	runtime.Gosched()
	time.Sleep(50 * time.Millisecond)
	phase("cpu_bound")

	pinned := make(chan struct{})
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		close(pinned)
		deadline := time.Now().Add(1000 * time.Millisecond)
		x := 0
		for time.Now().Before(deadline) {
			x++
		}
		_ = x
	}()
	<-pinned
	time.Sleep(50 * time.Millisecond)
	phase("lock_os_thread")

	stopBusy.Store(true)
	busyWG.Wait()
	close(stopSleep)
	sleepWG.Wait()

	phase("cooldown")
	phase("done")
	fmt.Println("OK=1")
}
