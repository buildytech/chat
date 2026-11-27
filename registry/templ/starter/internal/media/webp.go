// Package media turns uploaded covers into WebP. JPEG, PNG, GIF and WebP
// are accepted, downscaled to MaxWidth and re-encoded: lossy quality 80 with
// cwebp when it is installed on the host (package "webp"), otherwise
// lossless in pure Go, so the binary keeps CGO_ENABLED=0.
package media

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/draw"
	_ "image/gif"  // decoder
	_ "image/jpeg" // decoder
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/HugoSmits86/nativewebp"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // decoder
)

// Limits of an upload.
const (
	MaxBytes  = 8 << 20
	MaxPixels = 40_000_000
	MaxWidth  = 1600
)

// ErrNotImage is returned for files that are not a supported image.
var ErrNotImage = errors.New("media: upload a JPEG, PNG, GIF or WebP image up to 8 MB")

// ToWebP decodes src, downscales it to MaxWidth and returns WebP bytes.
func ToWebP(src []byte) ([]byte, error) {
	if len(src) == 0 || len(src) > MaxBytes {
		return nil, ErrNotImage
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(src))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > MaxPixels {
		return nil, ErrNotImage
	}
	img, _, err := image.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, ErrNotImage
	}
	img = fit(img, MaxWidth)
	if out, err := cwebp(img); err == nil {
		return out, nil
	}
	var buf bytes.Buffer
	if err := nativewebp.Encode(&buf, img, nil); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// Encode writes img as WebP (used by the demo seed for generated art).
func Encode(img image.Image) ([]byte, error) {
	if out, err := cwebp(img); err == nil {
		return out, nil
	}
	var buf bytes.Buffer
	err := nativewebp.Encode(&buf, img, nil)
	return buf.Bytes(), err
}

func fit(img image.Image, maxW int) image.Image {
	b := img.Bounds()
	if b.Dx() <= maxW {
		rgba := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
		draw.Draw(rgba, rgba.Bounds(), img, b.Min, draw.Src)
		return rgba
	}
	h := b.Dy() * maxW / b.Dx()
	dst := image.NewNRGBA(image.Rect(0, 0, maxW, h))
	xdraw.ApproxBiLinear.Scale(dst, dst.Bounds(), img, b, xdraw.Src, nil)
	return dst
}

// cwebp encodes through the cwebp tool (lossy, q80) when it is on PATH.
func cwebp(img image.Image) ([]byte, error) {
	bin, err := exec.LookPath("cwebp")
	if err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp("", "cover-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	in, out := filepath.Join(dir, "in.png"), filepath.Join(dir, "out.webp")
	f, err := os.Create(in)
	if err != nil {
		return nil, err
	}
	if err := png.Encode(f, img); err != nil {
		f.Close()
		return nil, err
	}
	f.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := exec.CommandContext(ctx, bin, "-quiet", "-q", "80", "-m", "4", in, "-o", out).Run(); err != nil {
		return nil, err
	}
	return os.ReadFile(out)
}
