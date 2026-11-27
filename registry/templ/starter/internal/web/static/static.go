// Package static embeds the public assets: the compiled stylesheet
// (make css), app.js, the favicon and the self-hosted fonts.
package static

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"io/fs"
	"sync"
)

//go:embed app.css app.js favicon.svg fonts all:images
var files embed.FS

// FS is the asset tree served under /static/.
func FS() fs.FS { return files }

var (
	mu       sync.Mutex
	versions = map[string]string{}
)

// Path returns /static/<name>?v=<hash> so long cache lifetimes are safe.
func Path(name string) string {
	mu.Lock()
	defer mu.Unlock()
	if v, ok := versions[name]; ok {
		return v
	}
	p := "/static/" + name
	if b, err := files.ReadFile(name); err == nil {
		sum := sha256.Sum256(b)
		p += "?v=" + hex.EncodeToString(sum[:])[:10]
	}
	versions[name] = p
	return p
}
