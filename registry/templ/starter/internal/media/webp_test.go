package media

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func TestToWebP(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2000, 1000))
	for x := 0; x < 2000; x += 7 {
		img.Set(x, x/2, color.RGBA{200, 10, 10, 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	out, err := ToWebP(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix(out, []byte("RIFF")) || !bytes.Equal(out[8:12], []byte("WEBP")) {
		t.Fatal("not a WebP file")
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(out))
	if err != nil || format != "webp" || cfg.Width != MaxWidth {
		t.Fatalf("decoded %v %s %d", err, format, cfg.Width)
	}
	if _, err := ToWebP([]byte("<svg/>")); err == nil {
		t.Fatal("svg must be refused")
	}
}
