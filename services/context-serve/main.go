package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/buildytech/chat/services/context-serve/internal/pagehttp"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
)

func main() {
	addr := listenAddr(getenv("CONTEXT_SERVE_ADDR", "127.0.0.1:8090"))
	dbPath := getenv("PAGE_STORE_PATH", "data/pages.sqlite")
	store, err := pagestore.Open(dbPath)
	if err != nil {
		log.Fatalf("page store: %v", err)
	}
	defer store.Close()
	log.Printf("context-serve page store on %s (sqlite %s; CR not wired)", addr, dbPath)
	if err := http.ListenAndServe(addr, pagehttp.NewMux(store)); err != nil {
		log.Fatal(err)
	}
}

func listenAddr(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return "127.0.0.1:8090"
	}
	if strings.HasPrefix(addr, ":") {
		return "127.0.0.1" + addr
	}
	return addr
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
