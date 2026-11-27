// Package config reads the runtime configuration from the environment.
// Every setting has a safe default; production refuses to start without
// the few values it cannot guess (see Validate).
package config

import (
	"errors"
	"net/netip"
	"net/url"
	"os"
	"strings"

	"github.com/fastygo/starter/internal/preset"
)

// Env names. Keep deploy/site.env.example in sync.
const (
	EnvMode           = "SITE_ENV"             // development (default) | production
	EnvPreset         = "SITE_PRESET"          // blog | corporate | shop; overrides the stored preset
	EnvBaseURL        = "SITE_BASE_URL"        // public origin, e.g. https://example.com
	EnvAdminAllow     = "SITE_ADMIN_ALLOW"     // CIDRs allowed to reach /_/ and /api/ (default loopback)
	EnvTrustedProxies = "SITE_TRUSTED_PROXIES" // CIDRs of reverse proxies allowed to set X-Forwarded-For
	EnvDemoPassword   = "SITE_DEMO_PASSWORD"   // password of the local demo admin (dev only)
	EnvAccessLog      = "SITE_ACCESS_LOG"      // off (default) | anon | full: request logs, see PRIVACY.md
)

// Access log modes. Enabling anything but AccessLogOff is a deliberate
// decision that must be reflected in the site's legal documents.
const (
	AccessLogOff  = "off"  // no request logs are written by the app
	AccessLogAnon = "anon" // request logs without client IPs, 3 days
	AccessLogFull = "full" // request logs with client IPs, 7 days
)

// DefaultAccessLog is the mode when SITE_ACCESS_LOG is unset. CI checks
// that it stays off (scripts/privacy-check.sh).
const DefaultAccessLog = AccessLogOff

// Config is the parsed environment.
type Config struct {
	Production bool
	Preset     string // empty: use the stored preset
	BaseURL    string
	AdminAllow []netip.Prefix
	Trusted    []netip.Prefix
	DemoPass   string
	AccessLog  string // off | anon | full
}

// Load parses the environment with getenv (os.Getenv in production).
func Load(getenv func(string) string) (Config, error) {
	if getenv == nil {
		getenv = os.Getenv
	}
	c := Config{
		Production: strings.EqualFold(strings.TrimSpace(getenv(EnvMode)), "production"),
		Preset:     strings.TrimSpace(strings.ToLower(getenv(EnvPreset))),
		BaseURL:    strings.TrimRight(strings.TrimSpace(getenv(EnvBaseURL)), "/"),
		DemoPass:   getenv(EnvDemoPassword),
		AccessLog:  strings.ToLower(strings.TrimSpace(getenv(EnvAccessLog))),
	}
	if c.AccessLog == "" {
		c.AccessLog = DefaultAccessLog
	}
	allow := getenv(EnvAdminAllow)
	if strings.TrimSpace(allow) == "" {
		allow = "127.0.0.1/32,::1/128"
	}
	var err error
	if c.AdminAllow, err = ParsePrefixes(allow); err != nil {
		return c, err
	}
	if c.Trusted, err = ParsePrefixes(getenv(EnvTrustedProxies)); err != nil {
		return c, err
	}
	return c, c.Validate()
}

// Validate checks values that must be right before serving.
func (c Config) Validate() error {
	if c.Preset != "" && !preset.Valid(c.Preset) {
		return errors.New("config: " + EnvPreset + " must be blog, corporate or shop")
	}
	switch c.AccessLog {
	case "", AccessLogOff, AccessLogAnon, AccessLogFull:
	default:
		return errors.New("config: " + EnvAccessLog + " must be off, anon or full")
	}
	if c.BaseURL != "" {
		u, err := url.Parse(c.BaseURL)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			return errors.New("config: " + EnvBaseURL + " must be an absolute http(s) URL")
		}
	}
	if c.Production {
		if !strings.HasPrefix(c.BaseURL, "https://") {
			return errors.New("config: production needs " + EnvBaseURL + "=https://...")
		}
		if c.DemoPass != "" {
			return errors.New("config: " + EnvDemoPassword + " is for local development only")
		}
	}
	return nil
}

// ParsePrefixes parses a comma or space separated list of CIDRs or single
// addresses.
func ParsePrefixes(s string) ([]netip.Prefix, error) {
	var out []netip.Prefix
	for _, f := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ' ' || r == '\t' || r == '\n' }) {
		if strings.Contains(f, "/") {
			p, err := netip.ParsePrefix(f)
			if err != nil {
				return nil, errors.New("config: bad CIDR " + f)
			}
			out = append(out, p.Masked())
			continue
		}
		a, err := netip.ParseAddr(f)
		if err != nil {
			return nil, errors.New("config: bad address " + f)
		}
		a = a.Unmap()
		out = append(out, netip.PrefixFrom(a, a.BitLen()))
	}
	return out, nil
}
