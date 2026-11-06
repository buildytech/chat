package contextclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client talks to a real fastygo/context HTTP API v1 (not a stub).
type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

func FromEnv() *Client {
	base := strings.TrimSpace(os.Getenv("CONTEXT_RUNTIME_URL"))
	if base == "" {
		base = strings.TrimSpace(os.Getenv("CONTEXT_SERVE_URL"))
	}
	if base == "" {
		return nil
	}
	tok := strings.TrimSpace(os.Getenv("CONTEXT_SERVE_TOKEN"))
	return &Client{
		BaseURL: strings.TrimRight(base, "/"),
		Token:   tok,
		HTTP:    &http.Client{Timeout: 20 * time.Second},
	}
}

type Health struct {
	APIVersion string `json:"api_version"`
	OK         bool   `json:"ok"`
	Ready      bool   `json:"ready"`
}

func (c *Client) Health(ctx context.Context) (Health, error) {
	var h Health
	if err := c.get(ctx, "/health", &h); err != nil {
		return Health{}, err
	}
	return h, nil
}

type PackResult struct {
	ContextPack json.RawMessage `json:"context_pack"`
	FocusID     string          `json:"focus_id"`
}

func (c *Client) ContextPack(ctx context.Context, projectID, query string) (PackResult, error) {
	var out PackResult
	body := map[string]string{"project_id": projectID, "query": query}
	if err := c.post(ctx, "/v1/context-pack", body, &out); err != nil {
		return PackResult{}, err
	}
	return out, nil
}

func (c *Client) get(ctx context.Context, path string, dest any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	return c.do(req, dest)
}

func (c *Client) post(ctx context.Context, path string, payload any, dest any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+path, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req, dest)
}

func (c *Client) do(req *http.Request, dest any) error {
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if res.StatusCode >= 300 {
		return fmt.Errorf("context runtime %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	if dest == nil {
		return nil
	}
	return json.Unmarshal(b, dest)
}
