package main

import (
	"fmt"
	"net/http"
	"os"
)

func handler(resp http.ResponseWriter, req *http.Request) {
	resp.WriteHeader(200)
	resp.Write([]byte("hello from go"))
}

func main() {
	bindAddr := os.Getenv("SERVER_BIND_ADDR")
	if bindAddr == "" {
		bindAddr = ":9000"
	}
	fmt.Printf("Listening on %s", bindAddr)
	http.ListenAndServe(bindAddr, http.HandlerFunc(handler))
}
