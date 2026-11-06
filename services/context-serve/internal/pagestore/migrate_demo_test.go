package pagestore

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestMigrateDemoCopyPreservesPage(t *testing.T) {
	src := "/home/box/.config/buildy-demo/pages.sqlite"
	if _, err := os.Stat(src); err != nil {
		t.Skip("demo db missing")
	}
	dir := t.TempDir()
	dst := filepath.Join(dir, "pages.sqlite")
	for _, suffix := range []string{"", "-wal", "-shm"} {
		inPath := src + suffix
		in, err := os.Open(inPath)
		if err != nil {
			if suffix == "" {
				t.Fatal(err)
			}
			continue
		}
		out, err := os.Create(dst + suffix)
		if err != nil {
			in.Close()
			t.Fatal(err)
		}
		_, err = io.Copy(out, in)
		in.Close()
		out.Close()
		if err != nil {
			t.Fatal(err)
		}
	}
	s, err := Open(dst)
	if err != nil {
		t.Fatalf("migrate open: %v", err)
	}
	defer s.Close()
	rec, err := s.GetByID(context.Background(), "page-5975af4003592b2c")
	if err != nil {
		t.Fatalf("preserved page: %v", err)
	}
	if rec.Page.Slug != "mangal-ny-live3" {
		t.Fatalf("slug %s", rec.Page.Slug)
	}
}
