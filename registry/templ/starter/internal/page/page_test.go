package page

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestEveryBlockRenders(t *testing.T) {
	d, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if d.Preset != "blog" && d.Preset != "corporate" && d.Preset != "shop" {
		t.Fatalf("preset %q", d.Preset)
	}
	var out bytes.Buffer
	if err := Blocks().Render(context.Background(), &out); err != nil {
		t.Fatal(err)
	}
	for _, b := range d.Blocks {
		if !strings.Contains(out.String(), `data-slot="`+b.Item+`"`) {
			t.Fatalf("block %s (%s) is not on the page", b.ID, b.Item)
		}
	}
}

func TestUnknownItem(t *testing.T) {
	if _, err := component("no-such-block", []byte(`{}`)); err == nil {
		t.Fatal("an unknown item must fail")
	}
}
