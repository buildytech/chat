package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/buildytech/chat/services/context-serve/internal/httpsafe"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
	"github.com/buildytech/chat/services/context-serve/internal/sessionhttp"
	"github.com/buildytech/chat/services/context-serve/internal/sessionstore"
)

func main() {
	addr := listenAddr(getenv("CONTEXT_SERVE_ADDR", "127.0.0.1:8090"))
	dbPath := getenv("PAGE_STORE_PATH", "data/pages.sqlite")
	store, err := pagestore.Open(dbPath)
	if err != nil {
		log.Fatalf("page store: %v", err)
	}
	defer store.Close()
	sessions := sessionstore.New(store)
	log.Printf("context-serve page+session foundation on %s (sqlite %s; live agent runtime not wired)", addr, dbPath)
	handler := httpsafe.Wrap(sessionhttp.NewMux(store, sessions))
	if err := http.ListenAndServe(addr, handler); err != nil {
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
