package web_test

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/fastygo/starter/internal/i18n"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/ui/dict"
)

// TestDictionaryCoversKeys fails when a screen, block or handler uses a
// dictionary key that ui/dict/en.json does not define.
func TestDictionaryCoversKeys(t *testing.T) {
	d, err := i18n.Parse(dict.EN)
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`(?:\bT|\.t|Dict\.F)\("([a-z_]+\.[a-z_.]+)"`)
	var missing []string
	for _, root := range []string{"../../internal", "../../ui/blocks"} {
		_ = filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() || strings.HasSuffix(p, "_templ.go") || strings.HasSuffix(p, "_test.go") {
				return nil
			}
			if !strings.HasSuffix(p, ".go") && !strings.HasSuffix(p, ".templ") {
				return nil
			}
			b, _ := os.ReadFile(p)
			for _, m := range re.FindAllStringSubmatch(string(b), -1) {
				if !strings.HasSuffix(m[1], ".") && !d.Has(m[1]) {
					missing = append(missing, p+": "+m[1])
				}
			}
			return nil
		})
	}
	// keys built at runtime
	for _, p := range preset.All {
		for _, k := range []string{"eyebrow", "title", "lead", "cta"} {
			if !d.Has("home." + p + "." + k) {
				missing = append(missing, "home."+p+"."+k)
			}
		}
		if !d.Has("preset." + p) {
			missing = append(missing, "preset."+p)
		}
		for _, s := range preset.Sections(p) {
			for _, k := range []string{s.Label, s.Singular, "lead." + s.Collection} {
				if !d.Has(k) {
					missing = append(missing, k)
				}
			}
			for _, f := range s.Fields {
				if !d.Has(f.Label) {
					missing = append(missing, f.Label)
				}
			}
		}
	}
	for _, k := range []string{"role.admin", "role.editor", "status.draft", "status.published"} {
		if !d.Has(k) {
			missing = append(missing, k)
		}
	}
	if len(missing) > 0 {
		t.Fatalf("missing dictionary keys:\n%s", strings.Join(missing, "\n"))
	}
}

// TestIconsExist fails when a Lucide icon name is not in the kit registry
// (the kit would silently draw a circle instead).
func TestIconsExist(t *testing.T) {
	reg, err := os.ReadFile("../../ui/kit/icons/lucide_icons.go")
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`(?:LucideIconProps\{Name|Icon): +"([a-z0-9-]+)"`)
	var missing []string
	for _, root := range []string{"../../internal", "../../ui/blocks"} {
		_ = filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() || strings.HasSuffix(p, "_templ.go") || strings.HasSuffix(p, "_test.go") {
				return nil
			}
			if !strings.HasSuffix(p, ".go") && !strings.HasSuffix(p, ".templ") {
				return nil
			}
			b, _ := os.ReadFile(p)
			for _, m := range re.FindAllStringSubmatch(string(b), -1) {
				if !strings.Contains(string(reg), "\t\""+m[1]+"\": {") {
					missing = append(missing, p+": "+m[1])
				}
			}
			return nil
		})
	}
	if len(missing) > 0 {
		t.Fatalf("unknown Lucide icons:\n%s", strings.Join(missing, "\n"))
	}
}
