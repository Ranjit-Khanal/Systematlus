// TCP experiment: raw client/server on loopback. Emits markers for agent ss polling.
package main

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os"
	"time"
)

func emit(line string) {
	fmt.Println(line)
	_ = os.Stdout.Sync()
}

func phase(name string) {
	emit("PHASE=" + name)
	time.Sleep(700 * time.Millisecond)
}

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	emit(fmt.Sprintf("PID=%d", os.Getpid()))
	emit(fmt.Sprintf("PORT=%d", port))
	emit(fmt.Sprintf("SERVER=%s", ln.Addr()))

	acceptCh := make(chan net.Conn, 1)
	errCh := make(chan error, 1)
	go func() {
		// Delay accept slightly so ss can observe LISTEN before ESTAB.
		time.Sleep(150 * time.Millisecond)
		c, err := ln.Accept()
		if err != nil {
			errCh <- err
			return
		}
		acceptCh <- c
	}()

	phase("listen")

	emit("CONNECT_STARTED")
	dialer := net.Dialer{Timeout: 2 * time.Second}
	client, err := dialer.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "dial: %v\n", err)
		os.Exit(1)
	}
	emit(fmt.Sprintf("CLIENT_LOCAL=%s", client.LocalAddr()))
	emit(fmt.Sprintf("CLIENT_REMOTE=%s", client.RemoteAddr()))
	phase("handshake")

	var server net.Conn
	select {
	case server = <-acceptCh:
	case err := <-errCh:
		fmt.Fprintf(os.Stderr, "accept: %v\n", err)
		os.Exit(1)
	case <-time.After(2 * time.Second):
		fmt.Fprintln(os.Stderr, "accept timeout")
		os.Exit(1)
	}
	emit(fmt.Sprintf("SERVER_REMOTE=%s", server.RemoteAddr()))
	phase("connected")

	msg := []byte("PING\n")
	if _, err := client.Write(msg); err != nil {
		fmt.Fprintf(os.Stderr, "write: %v\n", err)
		os.Exit(1)
	}
	line, err := bufio.NewReader(server).ReadString('\n')
	if err != nil {
		fmt.Fprintf(os.Stderr, "server read: %v\n", err)
		os.Exit(1)
	}
	if _, err := server.Write([]byte("PONG\n")); err != nil {
		fmt.Fprintf(os.Stderr, "server write: %v\n", err)
		os.Exit(1)
	}
	resp, err := bufio.NewReader(client).ReadString('\n')
	if err != nil {
		fmt.Fprintf(os.Stderr, "client read: %v\n", err)
		os.Exit(1)
	}
	emit(fmt.Sprintf("DATA_SENT=%d", len(msg)))
	emit(fmt.Sprintf("DATA_RECV=%d", len(resp)))
	emit(fmt.Sprintf("PAYLOAD=%q", line))
	phase("data")

	emit("CLOSE_STARTED")
	_ = client.Close()
	phase("close_client")
	_, _ = io.Copy(io.Discard, server)
	_ = server.Close()
	_ = ln.Close()
	phase("closed")

	emit("OK=1")
}
