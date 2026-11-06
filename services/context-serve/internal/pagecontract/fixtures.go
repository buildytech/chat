package pagecontract

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

func FixturesDir() string {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return filepath.Join("..", "..", "..", "..", "packages", "page-contract", "fixtures")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "packages", "page-contract", "fixtures"))
}

func LoadValidDraftJSON() ([]byte, error) {
	return os.ReadFile(filepath.Join(FixturesDir(), "north-harbor-kitchen.json"))
}

func LoadValidDraft() (Page, error) {
	raw, err := LoadValidDraftJSON()
	if err != nil {
		return Page{}, err
	}
	return ParseJSON(raw, true)
}

func CloneValidDraftMap() (map[string]any, error) {
	raw, err := LoadValidDraftJSON()
	if err != nil {
		return nil, err
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	return doc, nil
}

type ConformanceSpec struct {
	Constants struct {
		LayoutVersion int      `json:"layoutVersion"`
		BlockKinds    []string `json:"blockKinds"`
		CopyKeys      []string `json:"copyKeys"`
		Statuses      []string `json:"statuses"`
		Limits        struct {
			MaxBlocks        int `json:"maxBlocks"`
			MaxDepth         int `json:"maxDepth"`
			MaxIDLength      int `json:"maxIdLength"`
			MaxSlugLength    int `json:"maxSlugLength"`
			MaxTitleLength   int `json:"maxTitleLength"`
			MaxSummaryLength int `json:"maxSummaryLength"`
			MaxCopyLength    int `json:"maxCopyLength"`
			MaxSEOLength     int `json:"maxSeoLength"`
			MaxLocaleLength  int `json:"maxLocaleLength"`
			MaxJSONChars     int `json:"maxJsonChars"`
		} `json:"limits"`
	} `json:"constants"`
	ValidDraft string            `json:"validDraft"`
	Cases      []ConformanceCase `json:"cases"`
}

type ConformanceCase struct {
	Name        string     `json:"name"`
	Parser      string     `json:"parser"`
	Code        string     `json:"code"`
	Set         []Mutation `json:"set"`
	PadBlocks   int        `json:"padBlocks"`
	NestDepth   int        `json:"nestDepth"`
	RepeatTitle int        `json:"repeatTitle"`
	RepeatSlug  int        `json:"repeatSlug"`
}

type Mutation struct {
	Path  []any `json:"path"`
	Value any   `json:"value"`
}

func LoadConformanceSpec() (ConformanceSpec, error) {
	raw, err := os.ReadFile(filepath.Join(FixturesDir(), "conformance-cases.json"))
	if err != nil {
		return ConformanceSpec{}, err
	}
	var spec ConformanceSpec
	if err := json.Unmarshal(raw, &spec); err != nil {
		return ConformanceSpec{}, err
	}
	return spec, nil
}

func ApplyCase(base map[string]any, c ConformanceCase) (any, error) {
	raw, err := marshalCompact(base)
	if err != nil {
		return nil, err
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	for _, op := range c.Set {
		if err := setPath(doc, op.Path, op.Value); err != nil {
			return nil, err
		}
	}
	if c.RepeatTitle > 0 {
		doc["title"] = repeat("n", c.RepeatTitle)
	}
	if c.RepeatSlug > 0 {
		doc["slug"] = repeat("a", c.RepeatSlug)
	}
	if c.PadBlocks > 0 {
		layout := doc["layout"].(map[string]any)
		blocks := layout["blocks"].([]any)
		for i := 0; i < c.PadBlocks; i++ {
			blocks = append(blocks, map[string]any{
				"id":      "block-extra-" + strconv.Itoa(i),
				"kind":    "feature",
				"title":   "Extra",
				"summary": "Padding block for the count limit.",
			})
		}
		layout["blocks"] = blocks
	}
	if c.NestDepth > 0 {
		layout := doc["layout"].(map[string]any)
		layout["blocks"] = []any{nest(c.NestDepth)}
	}
	return doc, nil
}

func nest(depth int) map[string]any {
	block := map[string]any{
		"id":      "block-d" + strconv.Itoa(depth),
		"kind":    "feature",
		"title":   "Nested",
		"summary": "Depth probe.",
	}
	if depth > 1 {
		block["children"] = []any{nest(depth - 1)}
	}
	return block
}

func setPath(doc map[string]any, path []any, value any) error {
	var cursor any = doc
	for i := 0; i < len(path)-1; i++ {
		cursor = index(cursor, path[i])
	}
	last := path[len(path)-1]
	switch c := cursor.(type) {
	case map[string]any:
		c[asKey(last)] = value
	case []any:
		panic("setPath on array element replacement not used")
	default:
		return fail("invalid_type", "$", "cannot apply conformance mutation")
	}
	return nil
}

func index(cursor any, seg any) any {
	switch c := cursor.(type) {
	case map[string]any:
		return c[asKey(seg)]
	case []any:
		return c[asIndex(seg)]
	default:
		return nil
	}
}

func asKey(seg any) string {
	switch v := seg.(type) {
	case string:
		return v
	default:
		return strconv.Itoa(asIndex(v))
	}
}

func asIndex(seg any) int {
	switch v := seg.(type) {
	case float64:
		return int(v)
	case json.Number:
		i, _ := v.Int64()
		return int(i)
	case int:
		return v
	default:
		return 0
	}
}

func repeat(ch string, n int) string {
	return strings.Repeat(ch, n)
}
