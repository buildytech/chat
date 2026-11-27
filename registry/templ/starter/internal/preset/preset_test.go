package preset

import "testing"

func TestSections(t *testing.T) {
	want := map[string][]string{
		Blog:      {"articles"},
		Corporate: {"services", "cases", "articles"},
		Shop:      {"products", "articles"},
	}
	for p, cols := range want {
		got := Sections(p)
		if len(got) != len(cols) {
			t.Fatalf("%s: %d sections", p, len(got))
		}
		for i, s := range got {
			if s.Collection != cols[i] {
				t.Fatalf("%s[%d] = %s", p, i, s.Collection)
			}
			if s.Fields[0].Name != "title" {
				t.Fatalf("%s: first field %s", s.Collection, s.Fields[0].Name)
			}
		}
	}
	if _, ok := Find(Blog, "products"); ok {
		t.Fatal("blog must not have products")
	}
	if !HasCart(Shop) || HasCart(Corporate) || !HasContactPage(Corporate) || HasContactPage(Shop) {
		t.Fatal("feature flags")
	}
}
