package lexproto

import (
	"context"
	"errors"
	"testing"
)

func TestUnavailableNeverSucceeds(t *testing.T) {
	a := NewDefault()
	if a.Available() {
		t.Fatal("lexproto must report Available=false until a real runtime exists")
	}
	res, err := a.Evaluate(context.Background(), Request{Query: "x"})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("want ErrUnavailable, got %v", err)
	}
	if res.OK {
		t.Fatal("must not stub success")
	}
	if res.Message == "" {
		t.Fatal("must explain missing artifact")
	}
	st := Status()
	if st["available"] != false {
		t.Fatalf("Status.available=%v", st["available"])
	}
}
