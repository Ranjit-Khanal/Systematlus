// Process experiment: create a short-lived child and print structured facts to stdout.
// The agent reads /proc for REAL measurements; this program only creates the process tree.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"time"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--child" {
		fmt.Printf("CHILD_PID=%d\n", os.Getpid())
		fmt.Printf("CHILD_PPID=%d\n", os.Getppid())
		time.Sleep(800 * time.Millisecond)
		fmt.Println("CHILD_DONE=1")
		return
	}

	fmt.Printf("PARENT_PID=%d\n", os.Getpid())
	fmt.Printf("PARENT_PPID=%d\n", os.Getppid())

	cmd := exec.Command(os.Args[0], "--child")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "start child: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("SPAWNED_CHILD_PID=%d\n", cmd.Process.Pid)
	_ = cmd.Wait()
	fmt.Println("PARENT_DONE=1")
}
