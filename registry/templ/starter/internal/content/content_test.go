package content

import (
	"strings"
	"testing"
)

func TestMarkdownSanitized(t *testing.T) {
	out := Markdown("# Hi\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) [ok](https://example.com)")
	if strings.Contains(out, "<script") || strings.Contains(out, "javascript:") {
		t.Fatalf("unsafe output: %s", out)
	}
	if !strings.Contains(out, "<h1") || !strings.Contains(out, `href="https://example.com"`) {
		t.Fatalf("missing markup: %s", out)
	}
}

func TestSlugify(t *testing.T) {
	for in, want := range map[string]string{
		"Hello, World!":       "hello-world",
		"  Go 1.27 release  ": "go-1-27-release",
		"\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440": "privet-mir",
	} {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}
