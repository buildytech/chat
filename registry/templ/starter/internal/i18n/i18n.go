// Package i18n is the UI dictionary: every word a screen shows comes from a
// flat key -> text JSON file (ui/dict/en.json), never from templ literals.
// Content (titles, bodies, brand) comes from PocketBase records instead.
package i18n

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Dict is one language.
type Dict struct {
	Lang  string
	words map[string]string
}

// Parse reads a dictionary file; "lang" is a required key.
func Parse(b []byte) (*Dict, error) {
	m := map[string]string{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("i18n: %w", err)
	}
	if m["lang"] == "" {
		return nil, fmt.Errorf("i18n: dictionary has no lang key")
	}
	return &Dict{Lang: m["lang"], words: m}, nil
}

// T returns the text of key, or the key itself so a gap is visible.
func (d *Dict) T(key string) string {
	if d == nil {
		return key
	}
	if v, ok := d.words[key]; ok {
		return v
	}
	return key
}

// F replaces {name} placeholders in the text of key.
func (d *Dict) F(key string, kv ...string) string {
	s := d.T(key)
	for i := 0; i+1 < len(kv); i += 2 {
		s = strings.ReplaceAll(s, "{"+kv[i]+"}", kv[i+1])
	}
	return s
}

// Has reports whether key exists.
func (d *Dict) Has(key string) bool {
	_, ok := d.words[key]
	return ok
}
