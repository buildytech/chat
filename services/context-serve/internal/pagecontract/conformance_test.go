package pagecontract

import (
	"slices"
	"testing"
)

func TestSharedConstants(t *testing.T) {
	spec, err := LoadConformanceSpec()
	if err != nil {
		t.Fatal(err)
	}
	if spec.Constants.LayoutVersion != LayoutVersion {
		t.Fatalf("layoutVersion %d != %d", spec.Constants.LayoutVersion, LayoutVersion)
	}
	if !slices.Equal(spec.Constants.BlockKinds, BlockKinds) {
		t.Fatalf("blockKinds mismatch: %v vs %v", spec.Constants.BlockKinds, BlockKinds)
	}
	if !slices.Equal(spec.Constants.CopyKeys, CopyKeys) {
		t.Fatalf("copyKeys mismatch")
	}
	if !slices.Equal(spec.Constants.Statuses, Statuses) {
		t.Fatalf("statuses mismatch")
	}
	l := spec.Constants.Limits
	if l.MaxBlocks != MaxBlocks || l.MaxDepth != MaxDepth || l.MaxJSONChars != MaxJSONChars || l.MaxSlugLength != MaxSlugLength {
		t.Fatalf("limits mismatch: %+v", l)
	}
}

func TestPublishedStatusesParsePage(t *testing.T) {
	spec, err := LoadConformanceSpec()
	if err != nil {
		t.Fatal(err)
	}
	base, err := CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	for _, status := range spec.Constants.Statuses {
		doc, err := ApplyCase(base, ConformanceCase{Set: []Mutation{{Path: []any{"status"}, Value: status}}})
		if err != nil {
			t.Fatal(err)
		}
		page, err := ParsePage(doc)
		if err != nil {
			t.Fatalf("status %s: %v", status, err)
		}
		if page.Status != status {
			t.Fatalf("got %s want %s", page.Status, status)
		}
	}
}

func TestConformanceCases(t *testing.T) {
	spec, err := LoadConformanceSpec()
	if err != nil {
		t.Fatal(err)
	}
	base, err := CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range spec.Cases {
		c := c
		t.Run(c.Name, func(t *testing.T) {
			input, err := ApplyCase(base, c)
			if err != nil {
				t.Fatal(err)
			}
			var page Page
			if c.Parser == "draft" {
				page, err = ParseDraftPage(input)
			} else {
				page, err = ParsePage(input)
			}
			if c.Code != "" {
				if err == nil {
					t.Fatalf("expected %s", c.Code)
				}
				ce, ok := err.(*Error)
				if !ok {
					t.Fatalf("got %T %v", err, err)
				}
				if ce.Code != c.Code {
					t.Fatalf("got %s want %s (%s)", ce.Code, c.Code, ce.Error())
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if page.ID != "page-home" {
				t.Fatalf("id %s", page.ID)
			}
		})
	}
}
