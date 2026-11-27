// Command site is the whole website in one binary: PocketBase embedded as a
// library (superuser admin UI, SQLite, migrations, files), templ server-side
// rendering for every public and cabinet page, and a few CLI commands.
//
//	go run ./cmd/site                       # = site dev: local demo on 127.0.0.1:8090
//	site init --preset shop --brand "Acme"  # choose the preset and brand
//	site serve --http 127.0.0.1:8090        # production (behind Caddy)
package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/fastygo/starter/internal/config"
	"github.com/fastygo/starter/internal/i18n"
	_ "github.com/fastygo/starter/internal/migrations" // schema
	"github.com/fastygo/starter/internal/privacy"
	"github.com/fastygo/starter/internal/web"
	"github.com/fastygo/starter/ui/dict"
)

func main() {
	// no arguments: the local demo (make run, go run ./cmd/site)
	if len(os.Args) == 1 {
		os.Args = append(os.Args, "dev")
	}

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		log.Fatal(err)
	}
	words, err := i18n.Parse(dict.EN)
	if err != nil {
		log.Fatal(err)
	}

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: dataDir()})
	app.RootCmd.Use = "site"
	app.RootCmd.Short = "Site starter: PocketBase + templ in one binary"
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: false})
	registerCommands(app, cfg)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		if !cfg.Production {
			log.Print("site: development mode (SITE_ENV is not production): no HSTS, cookies without Secure")
		}
		if err := privacy.ApplyLogSettings(se.App, cfg.AccessLog); err != nil {
			return err
		}
		log.Printf("site: access log %s (SITE_ACCESS_LOG; see PRIVACY.md)", cfg.AccessLog)
		web.New(se.App, cfg, words).Register(se.Router)
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func dataDir() string {
	if v := os.Getenv("SITE_DATA_DIR"); v != "" {
		return v
	}
	return "pb_data"
}
