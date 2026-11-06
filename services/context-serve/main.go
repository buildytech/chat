package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/basicauth"
	"github.com/buildytech/chat/services/context-serve/internal/httpsafe"
	"github.com/buildytech/chat/services/context-serve/internal/liveruntime"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
	"github.com/buildytech/chat/services/context-serve/internal/sessionhttp"
	"github.com/buildytech/chat/services/context-serve/internal/sessionstore"
	"github.com/buildytech/chat/services/context-serve/internal/siteauth"
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

	// Probe CR once at boot so /v1/capabilities reflects a real adapter check.
	crOK := agentruntime.ProbeContextRuntime()
	log.Printf("context-runtime probe: %v (CONTEXT_RUNTIME_URL=%q)", crOK, os.Getenv("CONTEXT_RUNTIME_URL"))

	if agentruntime.LiveRequested() {
		runner := &liveruntime.Runner{}
		sessions.LivePlanner = func(ctx context.Context, sess sessionstore.Session, req agentruntime.TurnRequest, history []sessionstore.Message) (agentruntime.TurnPlan, error) {
			hint := liveruntime.SessionHint{
				SessionID:  sess.ID,
				PageID:     sess.PageID,
				SlugIntent: sess.SlugIntent,
				Title:      sess.Title,
			}
			for _, m := range history {
				hint.History = append(hint.History, liveruntime.HistoryMessage{Role: m.Role, Content: m.Content})
			}
			return runner.Plan(ctx, hint, req)
		}
		log.Printf("live model REQUESTED (BUILDY_LIVE_MODEL); wired Session→liveruntime→agent-sdk; liveModel capability stays false until MarkLiveSuccess")
	} else {
		agentruntime.ClearLiveSuccess()
		log.Printf("live model off (idle); deterministic PlanTurn only")
	}

	log.Printf("context-serve page+session on %s (sqlite %s)", addr, dbPath)
	auth := basicauth.FromEnv()
	if auth.Enabled() {
		log.Printf("basic auth ENABLED (BUILDY_BASIC_AUTH_USER set; pass not logged)")
	} else {
		log.Printf("basic auth off (set BUILDY_BASIC_AUTH_USER+PASS for WP proxy / VPS)")
	}
	sites := siteauth.FromEnv()
	if sites.Enabled() {
		log.Printf("site tokens ENABLED (%d sites); X-BuildY-Site-Id/Token required (not a model spend gate alone)", len(sites))
	} else {
		log.Printf("site tokens off (set BUILDY_SITE_TOKENS for multi-WP isolation)")
	}
	handler := basicauth.Wrap(auth, siteauth.Wrap(sites, httpsafe.Wrap(sessionhttp.NewMux(store, sessions))))
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
