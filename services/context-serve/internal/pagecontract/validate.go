package pagecontract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"
)

const LayoutVersion = 1

var BlockKinds = []string{
	"nav", "nav-link", "hero", "features", "feature", "menu", "dish", "hours", "cta", "footer",
}

var CopyKeys = []string{
	"eyebrow", "headline", "lede", "action", "note", "brand", "contact", "legal", "days", "address",
}

var Statuses = []string{
	"draft", "pending", "scheduled", "published", "archived", "trashed",
}

const (
	MaxBlocks        = 64
	MaxDepth         = 4
	MaxIDLength      = 63
	MaxSlugLength    = 48
	MaxTitleLength   = 160
	MaxSummaryLength = 500
	MaxCopyLength    = 2000
	MaxSEOLength     = 200
	MaxLocaleLength  = 16
	MaxJSONChars     = 65536
)

var (
	idPattern       = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	slugPattern     = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	localePattern   = regexp.MustCompile(`^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$`)
	datetimePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$`)
	markupPattern   = regexp.MustCompile(`[<>{}]|<\?`)
	urlShapedPattern = regexp.MustCompile(`^[a-z][a-z0-9+.-]*://`)
)

var allowedSchemes = map[string]struct{}{
	"http:": {}, "https:": {}, "mailto:": {},
}

var dangerousSchemes = []string{"javascript:", "data:", "vbscript:", "file:"}

var pageKeys = setOf("id", "slug", "status", "title", "layout", "seo", "locale", "createdAt", "updatedAt")
var layoutKeys = setOf("version", "blocks")
var blockKeys = setOf("id", "kind", "title", "summary", "copy", "children")
var seoKeys = setOf("title", "description")
var copyKeySet = setOf(CopyKeys...)
var kindSet = setOf(BlockKinds...)
var statusSet = setOf(Statuses...)

type Error struct {
	Code string
	Path string
	Msg  string
}

func (e *Error) Error() string {
	return e.Code + " at " + e.Path + ": " + e.Msg
}

type Page struct {
	ID        string     `json:"id"`
	Slug      string     `json:"slug"`
	Status    string     `json:"status"`
	Title     string     `json:"title"`
	Layout    PageLayout `json:"layout"`
	SEO       PageSEO    `json:"seo"`
	Locale    string     `json:"locale"`
	CreatedAt string     `json:"createdAt"`
	UpdatedAt string     `json:"updatedAt"`
}

type PageLayout struct {
	Version int     `json:"version"`
	Blocks  []Block `json:"blocks"`
}

type PageSEO struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
}

type Block struct {
	ID       string            `json:"id"`
	Kind     string            `json:"kind"`
	Title    string            `json:"title"`
	Summary  string            `json:"summary"`
	Copy     map[string]string `json:"copy,omitempty"`
	Children []Block           `json:"children,omitempty"`
}

func ParsePage(input any) (Page, error) {
	if s, ok := input.(string); ok && utf8.RuneCountInString(s) > MaxJSONChars {
		return Page{}, fail("too_large", "$", "payload exceeds size limit")
	}
	encoded, err := marshalCompact(input)
	if err != nil {
		return Page{}, fail("invalid_type", "$", "value is not JSON-serializable")
	}
	if len(encoded) > MaxJSONChars {
		return Page{}, fail("too_large", "$", "payload exceeds size limit")
	}
	obj, err := asObject(input, "$")
	if err != nil {
		return Page{}, err
	}
	if err := assertOnlyKeys(obj, pageKeys, "$"); err != nil {
		return Page{}, err
	}
	seen := map[string]struct{}{}
	id, err := parseID(mustGet(obj, "id", "$"), "id", seen)
	if err != nil {
		return Page{}, err
	}
	slug, err := parseBoundedText(mustGet(obj, "slug", "$"), "slug", MaxSlugLength, true, slugPattern, "invalid_slug")
	if err != nil {
		return Page{}, err
	}
	status, err := asString(mustGet(obj, "status", "$"), "status")
	if err != nil {
		return Page{}, err
	}
	if _, ok := statusSet[status]; !ok {
		return Page{}, fail("invalid_status", "status", fmt.Sprintf("unsupported status %q", status))
	}
	title, err := parseBoundedText(mustGet(obj, "title", "$"), "title", MaxTitleLength, true, nil, "")
	if err != nil {
		return Page{}, err
	}
	layout, err := parseLayout(mustGet(obj, "layout", "$"), "layout", seen)
	if err != nil {
		return Page{}, err
	}
	seo, err := parseSEO(mustGet(obj, "seo", "$"), "seo")
	if err != nil {
		return Page{}, err
	}
	locale, err := parseBoundedText(mustGet(obj, "locale", "$"), "locale", MaxLocaleLength, true, localePattern, "invalid_locale")
	if err != nil {
		return Page{}, err
	}
	createdAt, err := parseBoundedText(mustGet(obj, "createdAt", "$"), "createdAt", 40, true, datetimePattern, "invalid_datetime")
	if err != nil {
		return Page{}, err
	}
	updatedAt, err := parseBoundedText(mustGet(obj, "updatedAt", "$"), "updatedAt", 40, true, datetimePattern, "invalid_datetime")
	if err != nil {
		return Page{}, err
	}
	return Page{
		ID: id, Slug: slug, Status: status, Title: title, Layout: layout, SEO: seo,
		Locale: locale, CreatedAt: createdAt, UpdatedAt: updatedAt,
	}, nil
}

func ParseDraftPage(input any) (Page, error) {
	page, err := ParsePage(input)
	if err != nil {
		return Page{}, err
	}
	if page.Status != "draft" {
		return Page{}, fail("invalid_status", "status", `ordinary draft creation requires status "draft"`)
	}
	return page, nil
}

func ParseJSON(raw []byte, draft bool) (Page, error) {
	if len(raw) > MaxJSONChars {
		return Page{}, fail("too_large", "$", "payload exceeds size limit")
	}
	var v any
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&v); err != nil {
		return Page{}, fail("invalid_type", "$", "expected object")
	}
	if draft {
		return ParseDraftPage(v)
	}
	return ParsePage(v)
}

func MarshalPage(page Page) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(page); err != nil {
		return nil, err
	}
	out := bytes.TrimSpace(buf.Bytes())
	return out, nil
}

func fail(code, path, msg string) *Error {
	return &Error{Code: code, Path: path, Msg: msg}
}

func setOf(keys ...string) map[string]struct{} {
	m := make(map[string]struct{}, len(keys))
	for _, k := range keys {
		m[k] = struct{}{}
	}
	return m
}

func marshalCompact(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSpace(buf.Bytes()), nil
}

func asObject(v any, path string) (map[string]any, error) {
	if m, ok := v.(missing); ok {
		return nil, fail("missing_field", path, fmt.Sprintf("missing %q", m.key))
	}
	m, ok := v.(map[string]any)
	if !ok || m == nil {
		return nil, fail("invalid_type", path, "expected object")
	}
	return m, nil
}

func assertOnlyKeys(obj map[string]any, allowed map[string]struct{}, path string) error {
	for key := range obj {
		if _, ok := allowed[key]; !ok {
			return fail("unexpected_key", path, fmt.Sprintf("unexpected key %q", key))
		}
	}
	return nil
}

func mustGet(obj map[string]any, key, path string) any {
	v, ok := obj[key]
	if !ok {
		return missing{key: key}
	}
	return v
}

type missing struct{ key string }

func asString(v any, path string) (string, error) {
	if m, ok := v.(missing); ok {
		return "", fail("missing_field", path, fmt.Sprintf("missing %q", m.key))
	}
	s, ok := v.(string)
	if !ok {
		return "", fail("invalid_type", path, "expected string")
	}
	return s, nil
}

func parseBoundedText(v any, path string, max int, required bool, pattern *regexp.Regexp, patternCode string) (string, error) {
	text, err := asString(v, path)
	if err != nil {
		return "", err
	}
	if required && strings.TrimSpace(text) == "" {
		return "", fail("empty_required", path, "must be non-empty")
	}
	if utf8.RuneCountInString(text) > max {
		return "", fail("too_long", path, fmt.Sprintf("exceeds %d characters", max))
	}
	if err := assertPlainText(text, path); err != nil {
		return "", err
	}
	if err := assertSafeURL(text, path); err != nil {
		return "", err
	}
	if pattern != nil && !pattern.MatchString(text) {
		code := patternCode
		if code == "" {
			code = "invalid_type"
		}
		return "", fail(code, path, "value does not match required pattern")
	}
	return text, nil
}

func assertPlainText(value, path string) error {
	for _, r := range value {
		if r <= 0x08 || r == 0x0B || r == 0x0C || (r >= 0x0E && r <= 0x1F) {
			return fail("unsafe_text", path, "control characters are not allowed")
		}
	}
	if markupPattern.MatchString(value) {
		return fail("unsafe_text", path, "markup or template syntax is not allowed")
	}
	return nil
}

func assertSafeURL(value, path string) error {
	var b strings.Builder
	for _, r := range value {
		if r > 0x20 {
			b.WriteRune(r)
		}
	}
	collapsed := strings.ToLower(b.String())
	for _, scheme := range dangerousSchemes {
		if strings.HasPrefix(collapsed, scheme) {
			return fail("unsafe_url", path, fmt.Sprintf("scheme %q is not allowed", scheme))
		}
	}
	trimmed := strings.ToLower(strings.TrimSpace(value))
	if strings.HasPrefix(trimmed, "mailto:") {
		return nil
	}
	loc := urlShapedPattern.FindStringIndex(trimmed)
	if loc == nil {
		return nil
	}
	scheme := trimmed[loc[0] : loc[1]-2]
	if _, ok := allowedSchemes[scheme]; !ok {
		return fail("unsafe_url", path, fmt.Sprintf("scheme %q is not allowed", scheme))
	}
	return nil
}

func parseID(v any, path string, seen map[string]struct{}) (string, error) {
	id, err := parseBoundedText(v, path, MaxIDLength, true, idPattern, "invalid_id")
	if err != nil {
		return "", err
	}
	if _, ok := seen[id]; ok {
		return "", fail("duplicate_id", path, fmt.Sprintf("duplicate id %q", id))
	}
	seen[id] = struct{}{}
	return id, nil
}

func parseCopy(v any, path string) (map[string]string, error) {
	obj, err := asObject(v, path)
	if err != nil {
		return nil, err
	}
	if err := assertOnlyKeys(obj, copyKeySet, path); err != nil {
		return nil, err
	}
	copy := map[string]string{}
	for _, key := range CopyKeys {
		if _, ok := obj[key]; !ok {
			continue
		}
		text, err := parseBoundedText(obj[key], path+"."+key, MaxCopyLength, false, nil, "")
		if err != nil {
			return nil, err
		}
		copy[key] = text
	}
	return copy, nil
}

func parseBlock(v any, path string, depth int, seen map[string]struct{}, counts *int) (Block, error) {
	if depth > MaxDepth {
		return Block{}, fail("too_deep", path, fmt.Sprintf("tree deeper than %d", MaxDepth))
	}
	*counts++
	if *counts > MaxBlocks {
		return Block{}, fail("too_many_blocks", path, fmt.Sprintf("more than %d blocks", MaxBlocks))
	}
	obj, err := asObject(v, path)
	if err != nil {
		return Block{}, err
	}
	if err := assertOnlyKeys(obj, blockKeys, path); err != nil {
		return Block{}, err
	}
	id, err := parseID(mustGet(obj, "id", path), path+".id", seen)
	if err != nil {
		return Block{}, err
	}
	kind, err := asString(mustGet(obj, "kind", path), path+".kind")
	if err != nil {
		return Block{}, err
	}
	if _, ok := kindSet[kind]; !ok {
		return Block{}, fail("unsupported_kind", path+".kind", fmt.Sprintf("unsupported block kind %q", kind))
	}
	title, err := parseBoundedText(mustGet(obj, "title", path), path+".title", MaxTitleLength, true, nil, "")
	if err != nil {
		return Block{}, err
	}
	summary, err := parseBoundedText(mustGet(obj, "summary", path), path+".summary", MaxSummaryLength, true, nil, "")
	if err != nil {
		return Block{}, err
	}
	block := Block{ID: id, Kind: kind, Title: title, Summary: summary}
	if _, ok := obj["copy"]; ok {
		cp, err := parseCopy(obj["copy"], path+".copy")
		if err != nil {
			return Block{}, err
		}
		block.Copy = cp
	}
	if _, ok := obj["children"]; ok {
		arr, err := asArray(obj["children"], path+".children")
		if err != nil {
			return Block{}, err
		}
		children := make([]Block, 0, len(arr))
		for i, child := range arr {
			parsed, err := parseBlock(child, fmt.Sprintf("%s.children[%d]", path, i), depth+1, seen, counts)
			if err != nil {
				return Block{}, err
			}
			children = append(children, parsed)
		}
		block.Children = children
	}
	return block, nil
}

func parseSEO(v any, path string) (PageSEO, error) {
	obj, err := asObject(v, path)
	if err != nil {
		return PageSEO{}, err
	}
	if err := assertOnlyKeys(obj, seoKeys, path); err != nil {
		return PageSEO{}, err
	}
	seo := PageSEO{}
	if _, ok := obj["title"]; ok {
		t, err := parseBoundedText(obj["title"], path+".title", MaxSEOLength, false, nil, "")
		if err != nil {
			return PageSEO{}, err
		}
		seo.Title = t
	}
	if _, ok := obj["description"]; ok {
		d, err := parseBoundedText(obj["description"], path+".description", MaxSEOLength, false, nil, "")
		if err != nil {
			return PageSEO{}, err
		}
		seo.Description = d
	}
	return seo, nil
}

func parseLayout(v any, path string, seen map[string]struct{}) (PageLayout, error) {
	obj, err := asObject(v, path)
	if err != nil {
		return PageLayout{}, err
	}
	if err := assertOnlyKeys(obj, layoutKeys, path); err != nil {
		return PageLayout{}, err
	}
	version, err := asInt(mustGet(obj, "version", path), path+".version")
	if err != nil {
		return PageLayout{}, err
	}
	if version != LayoutVersion {
		return PageLayout{}, fail("unsupported_version", path+".version", fmt.Sprintf("unsupported layout.version %d", version))
	}
	blocksRaw, err := asArray(mustGet(obj, "blocks", path), path+".blocks")
	if err != nil {
		return PageLayout{}, err
	}
	counts := 0
	blocks := make([]Block, 0, len(blocksRaw))
	for i, b := range blocksRaw {
		parsed, err := parseBlock(b, fmt.Sprintf("%s.blocks[%d]", path, i), 1, seen, &counts)
		if err != nil {
			return PageLayout{}, err
		}
		blocks = append(blocks, parsed)
	}
	return PageLayout{Version: LayoutVersion, Blocks: blocks}, nil
}

func asArray(v any, path string) ([]any, error) {
	if m, ok := v.(missing); ok {
		return nil, fail("missing_field", path, fmt.Sprintf("missing %q", m.key))
	}
	arr, ok := v.([]any)
	if !ok {
		return nil, fail("invalid_type", path, "expected array")
	}
	return arr, nil
}

func asInt(v any, path string) (int, error) {
	if m, ok := v.(missing); ok {
		return 0, fail("missing_field", path, fmt.Sprintf("missing %q", m.key))
	}
	switch n := v.(type) {
	case json.Number:
		s := string(n)
		if strings.ContainsAny(s, ".eE") {
			return 0, fail("invalid_type", path, "expected integer")
		}
		i, err := n.Int64()
		if err != nil {
			return 0, fail("invalid_type", path, "expected integer")
		}
		return int(i), nil
	case float64:
		if n != math.Trunc(n) || n < math.MinInt || n > math.MaxInt {
			return 0, fail("invalid_type", path, "expected integer")
		}
		return int(n), nil
	case int:
		return n, nil
	default:
		return 0, fail("invalid_type", path, "expected integer")
	}
}
