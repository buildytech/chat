package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func main() {
	addr := getenv("CONTEXT_SERVE_ADDR", ":8090")
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "context-serve stub: CR not wired")
	})
	log.Printf("context-serve stub listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
