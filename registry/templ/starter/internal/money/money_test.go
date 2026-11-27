package money

import "testing"

func TestFormat(t *testing.T) {
	cases := []struct {
		minor    int64
		cur, lng string
		want     string
	}{
		{149000, "USD", "en", "$1,490"},
		{1990, "USD", "en", "$19.90"},
		{149050, "RUB", "ru", "1\u00a0490,50\u00a0₽"},
		{100, "XYZ", "en", "1\u00a0XYZ"},
		{123456789, "", "en", "1,234,567.89"},
	}
	for _, c := range cases {
		if got := Format(c.minor, c.cur, c.lng); got != c.want {
			t.Errorf("Format(%d,%s,%s) = %q, want %q", c.minor, c.cur, c.lng, got, c.want)
		}
	}
}

func TestParse(t *testing.T) {
	ok := map[string]int64{"1490": 149000, "19.90": 1990, "19,9": 1990, "1 490,00": 149000, "1,490.00": 149000, "0": 0}
	for in, want := range ok {
		got, err := Parse(in)
		if err != nil || got != want {
			t.Errorf("Parse(%q) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, in := range []string{"", "-1", "1.234", "abc", "1.2.3"} {
		if _, err := Parse(in); err == nil {
			t.Errorf("Parse(%q) should fail", in)
		}
	}
	if Plain(1990) != "19.90" || Plain(149000) != "1490" {
		t.Fatal("Plain")
	}
}
