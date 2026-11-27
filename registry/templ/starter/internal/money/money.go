// Package money formats and parses prices kept as integer minor units
// (cents, kopecks). Floats never hold money.
package money

import (
	"errors"
	"strconv"
	"strings"
)

var symbols = map[string]struct {
	sym    string
	prefix bool
}{
	"USD": {"$", true}, "EUR": {"€", true}, "GBP": {"£", true},
	"RUB": {"₽", false}, "KZT": {"₸", false}, "UAH": {"₴", false}, "TRY": {"₺", false},
}

// Spec is how prices look for a currency and language. The browser cart
// (app.js) formats totals with the same rules as Format.
type Spec struct {
	Prefix    string `json:"prefix"`
	Suffix    string `json:"suffix"`
	Thousands string `json:"thousands"`
	Decimal   string `json:"decimal"`
}

// SpecFor returns the price format of currency for lang ("en" uses
// 1,490.50; other languages use 1 490,50 with a no-break space).
func SpecFor(currency, lang string) Spec {
	sp := Spec{Thousands: ",", Decimal: "."}
	if lang != "" && lang != "en" {
		sp.Thousands, sp.Decimal = "\u00a0", ","
	}
	cur := strings.ToUpper(currency)
	if v, ok := symbols[cur]; ok {
		if v.prefix {
			sp.Prefix = v.sym
		} else {
			sp.Suffix = "\u00a0" + v.sym
		}
	} else if cur != "" {
		sp.Suffix = "\u00a0" + cur
	}
	return sp
}

// Format renders minor units in currency for lang (see SpecFor).
func Format(minor int64, currency, lang string) string {
	sp := SpecFor(currency, lang)
	neg := minor < 0
	if neg {
		minor = -minor
	}
	whole, frac := minor/100, minor%100
	s := group(strconv.FormatInt(whole, 10), sp.Thousands)
	if frac != 0 {
		s += sp.Decimal + pad2(frac)
	}
	if neg {
		s = "-" + s
	}
	return sp.Prefix + s + sp.Suffix
}

func pad2(n int64) string {
	if n < 10 {
		return "0" + strconv.FormatInt(n, 10)
	}
	return strconv.FormatInt(n, 10)
}

func group(digits, sep string) string {
	if len(digits) <= 3 {
		return digits
	}
	var b strings.Builder
	head := len(digits) % 3
	if head > 0 {
		b.WriteString(digits[:head])
	}
	for i := head; i < len(digits); i += 3 {
		if b.Len() > 0 {
			b.WriteString(sep)
		}
		b.WriteString(digits[i : i+3])
	}
	return b.String()
}

// ErrBadAmount is returned for anything that is not a non-negative amount
// with at most two decimals.
var ErrBadAmount = errors.New("money: amount must look like 1490 or 19.90")

// Parse reads "1490", "19.90", "19,9" or "1 490,00" into minor units.
func Parse(s string) (int64, error) {
	s = strings.NewReplacer(" ", "", "\u00a0", "", "\u202f", "", "_", "").Replace(strings.TrimSpace(s))
	if s == "" {
		return 0, ErrBadAmount
	}
	if strings.Count(s, ",") == 1 && !strings.Contains(s, ".") {
		s = strings.Replace(s, ",", ".", 1)
	} else {
		s = strings.ReplaceAll(s, ",", "")
	}
	whole, frac, _ := strings.Cut(s, ".")
	if whole == "" || len(frac) > 2 || strings.Contains(frac, ".") {
		return 0, ErrBadAmount
	}
	for len(frac) < 2 {
		frac += "0"
	}
	w, err := strconv.ParseInt(whole, 10, 64)
	if err != nil || w < 0 || w > 1_000_000_000 {
		return 0, ErrBadAmount
	}
	f, err := strconv.ParseInt(frac, 10, 64)
	if err != nil || f < 0 {
		return 0, ErrBadAmount
	}
	return w*100 + f, nil
}

// Plain renders minor units as an editable amount ("19.90", "1490").
func Plain(minor int64) string {
	if minor%100 == 0 {
		return strconv.FormatInt(minor/100, 10)
	}
	return strconv.FormatInt(minor/100, 10) + "." + pad2(minor%100)
}
