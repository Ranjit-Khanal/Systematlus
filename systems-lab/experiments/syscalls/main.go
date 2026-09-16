// Syscall experiment: open / read / write / close a small file so strace can capture it.
package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	dir := os.TempDir()
	path := filepath.Join(dir, "systems-lab-syscall-demo.txt")
	content := []byte("systems-lab: hello from userspace\n")

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open write: %v\n", err)
		os.Exit(1)
	}
	if _, err := f.Write(content); err != nil {
		fmt.Fprintf(os.Stderr, "write: %v\n", err)
		os.Exit(1)
	}
	if err := f.Close(); err != nil {
		fmt.Fprintf(os.Stderr, "close: %v\n", err)
		os.Exit(1)
	}

	rf, err := os.Open(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open read: %v\n", err)
		os.Exit(1)
	}
	buf := make([]byte, 64)
	n, err := rf.Read(buf)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read: %v\n", err)
		os.Exit(1)
	}
	_ = rf.Close()
	fmt.Printf("READ_BYTES=%d\n", n)
	fmt.Printf("PATH=%s\n", path)
	fmt.Printf("DATA=%s", string(buf[:n]))
}
