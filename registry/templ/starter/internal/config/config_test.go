package config

import "testing"

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestDefaults(t *testing.T) {
	c, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if c.Production || len(c.AdminAllow) != 2 || len(c.Trusted) != 0 {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestProductionNeedsHTTPS(t *testing.T) {
	if _, err := Load(env(map[string]string{EnvMode: "production"})); err == nil {
		t.Fatal("production without base URL must fail")
	}
	if _, err := Load(env(map[string]string{EnvMode: "production", EnvBaseURL: "http://x.test"})); err == nil {
		t.Fatal("production over http must fail")
	}
	if _, err := Load(env(map[string]string{EnvMode: "production", EnvBaseURL: "https://x.test", EnvDemoPassword: "x"})); err == nil {
		t.Fatal("demo password in production must fail")
	}
	if _, err := Load(env(map[string]string{EnvMode: "production", EnvBaseURL: "https://x.test"})); err != nil {
		t.Fatal(err)
	}
}

func TestPreset(t *testing.T) {
	if _, err := Load(env(map[string]string{EnvPreset: "marketplace"})); err == nil {
		t.Fatal("unknown preset must fail")
	}
	c, err := Load(env(map[string]string{EnvPreset: "Shop"}))
	if err != nil || c.Preset != "shop" {
		t.Fatalf("got %q %v", c.Preset, err)
	}
}

func TestAccessLogDefaultsOff(t *testing.T) {
	c, err := Load(func(string) string { return "" })
	if err != nil || c.AccessLog != AccessLogOff || DefaultAccessLog != AccessLogOff {
		t.Fatalf("access log default = %q, %v", c.AccessLog, err)
	}
	if _, err := Load(func(k string) string {
		if k == EnvAccessLog {
			return "verbose"
		}
		return ""
	}); err == nil {
		t.Fatal("unknown SITE_ACCESS_LOG accepted")
	}
}
