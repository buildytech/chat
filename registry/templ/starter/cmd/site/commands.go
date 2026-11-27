package main

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"

	"github.com/fastygo/starter/internal/auth"
	"github.com/fastygo/starter/internal/config"
	"github.com/fastygo/starter/internal/content"
	"github.com/fastygo/starter/internal/page"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/seed"
	"github.com/fastygo/starter/internal/view"
)

func registerCommands(app *pocketbase.PocketBase, cfg config.Config) {
	app.RootCmd.SilenceUsage = true
	app.RootCmd.AddCommand(initCmd(app), devCmd(app, cfg), userCmd(app), roleCmd(app), demoCmd(app, cfg))
}

// migrate applies pending migrations (commands other than serve need it).
func migrate(app core.App) error { return app.RunAllMigrations() }

func initCmd(app *pocketbase.PocketBase) *cobra.Command {
	var p, brand, tagline, contactURL, contactLabel, contactVariant, contactSize, currency, lang string
	var contactNewWindow bool
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Choose the preset (blog, corporate, shop) and set the brand and the one contact link",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := migrate(app); err != nil {
				return err
			}
			st, _ := content.LoadSettings(app)
			if p != "" {
				st.Preset = p
			}
			set := func(dst *string, v string, flag string) {
				if cmd.Flags().Changed(flag) {
					*dst = v
				}
			}
			set(&st.Brand, brand, "brand")
			set(&st.Tagline, tagline, "tagline")
			set(&st.ContactURL, contactURL, "contact-url")
			set(&st.ContactLabel, contactLabel, "contact-label")
			set(&st.ContactVariant, contactVariant, "contact-variant")
			set(&st.ContactSize, contactSize, "contact-size")
			if cmd.Flags().Changed("contact-new-window") {
				st.ContactNewWindow = contactNewWindow
			}
			set(&st.Currency, currency, "currency")
			set(&st.Lang, lang, "lang")
			if !slices.Contains(view.ButtonVariants, st.ContactVariant) || !slices.Contains(view.ButtonSizes, st.ContactSize) {
				return fmt.Errorf("contact button: variant must be one of %v, size one of %v", view.ButtonVariants, view.ButtonSizes)
			}
			if err := content.SaveSettings(app, st); err != nil {
				return err
			}
			fmt.Printf("site: preset %s, brand %q, contact %q\n", st.Preset, st.Brand, st.ContactURL)
			return nil
		},
	}
	cmd.Flags().StringVar(&p, "preset", "", "blog | corporate | shop")
	cmd.Flags().StringVar(&brand, "brand", "", "brand name shown in the header")
	cmd.Flags().StringVar(&tagline, "tagline", "", "one-line tagline (home hero title)")
	cmd.Flags().StringVar(&contactURL, "contact-url", "", "the ONE contact link: https://t.me/..., https://wa.me/..., mailto:..., tel:...")
	cmd.Flags().StringVar(&contactLabel, "contact-label", "", "button text, e.g. \"Write us in Telegram\"")
	cmd.Flags().StringVar(&contactVariant, "contact-variant", "", "button variant: default | secondary | outline")
	cmd.Flags().StringVar(&contactSize, "contact-size", "", "button size: sm | default | lg")
	cmd.Flags().BoolVar(&contactNewWindow, "contact-new-window", false, "open the link in a new window (target=_blank rel=noopener noreferrer)")
	cmd.Flags().StringVar(&currency, "currency", "", "ISO currency code for prices, e.g. USD, EUR, RUB")
	cmd.Flags().StringVar(&lang, "lang", "", "page language code, e.g. en")
	return cmd
}

func devCmd(app *pocketbase.PocketBase, cfg config.Config) *cobra.Command {
	var p, addr string
	var noSeed bool
	cmd := &cobra.Command{
		Use:   "dev",
		Short: "Local demo: migrate, pick a preset, seed demo content and serve on localhost",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if cfg.Production {
				return errors.New("dev: refused with SITE_ENV=production; use serve")
			}
			if err := migrate(app); err != nil {
				return err
			}
			st, rec := content.LoadSettings(app)
			if p == "" {
				p = cfg.Preset
			}
			if p == "" && rec == nil {
				p = page.Preset() // the preset chosen in the BuildY Chat export
			}
			if p != "" || rec == nil {
				if p != "" {
					st.Preset = p
				}
				if err := content.SaveSettings(app, st); err != nil {
					return err
				}
			}
			if !noSeed {
				if err := runSeed(app, cfg, st.Preset, false); err != nil {
					return err
				}
			}
			fmt.Printf("\nsite: %s preset on http://%s  (cabinet: /cabinet, admin UI: /_/)\n\n", st.Preset, addr)
			return apis.Serve(app, apis.ServeConfig{HttpAddr: addr, ShowStartBanner: false})
		},
	}
	cmd.Flags().StringVar(&p, "preset", "", "blog | corporate | shop (default: stored preset, else blog)")
	cmd.Flags().StringVar(&addr, "http", "127.0.0.1:8090", "listen address (keep it on loopback)")
	cmd.Flags().BoolVar(&noSeed, "no-seed", false, "do not add demo content")
	return cmd
}

func userCmd(app *pocketbase.PocketBase) *cobra.Command {
	cmd := &cobra.Command{Use: "user", Short: "Cabinet users"}
	var name, password, role string
	add := &cobra.Command{
		Use:   "add <email>",
		Short: "Create a cabinet user (role editor by default); prints a generated password unless --password is set",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			if err := migrate(app); err != nil {
				return err
			}
			if role != auth.RoleEditor && role != auth.RoleAdmin {
				return errors.New("role must be editor or admin")
			}
			generated := password == ""
			if generated {
				password = randomPassword()
			}
			if _, err := ensureUser(app, args[0], name, password, role, true); err != nil {
				return err
			}
			if generated {
				fmt.Printf("user %s (%s) password: %s\n", args[0], role, password)
			} else {
				fmt.Printf("user %s (%s) saved\n", args[0], role)
			}
			return nil
		},
	}
	add.Flags().StringVar(&name, "name", "", "display name")
	add.Flags().StringVar(&password, "password", "", "password (min 10 chars); default: generated")
	add.Flags().StringVar(&role, "role", auth.RoleEditor, "editor | admin")
	cmd.AddCommand(add)
	return cmd
}

func roleCmd(app *pocketbase.PocketBase) *cobra.Command {
	cmd := &cobra.Command{Use: "role", Short: "Cabinet roles"}
	grant := &cobra.Command{
		Use:   "grant <email> <editor|admin>",
		Short: "Give an existing cabinet user a role",
		Args:  cobra.ExactArgs(2),
		RunE: func(_ *cobra.Command, args []string) error {
			if err := migrate(app); err != nil {
				return err
			}
			if args[1] != auth.RoleEditor && args[1] != auth.RoleAdmin {
				return errors.New("role must be editor or admin")
			}
			rec, err := app.FindAuthRecordByEmail("users", strings.ToLower(args[0]))
			if err != nil {
				return fmt.Errorf("no user %s (create it with: site user add %s)", args[0], args[0])
			}
			rec.Set("role", args[1])
			if err := app.Save(rec); err != nil {
				return err
			}
			fmt.Printf("%s is now %s\n", args[0], args[1])
			return nil
		},
	}
	cmd.AddCommand(grant)
	return cmd
}

func demoCmd(app *pocketbase.PocketBase, cfg config.Config) *cobra.Command {
	cmd := &cobra.Command{Use: "demo", Short: "Demo content (local development only)"}
	var reset bool
	seedCmd := &cobra.Command{
		Use:   "seed",
		Short: "Add demo content for the current preset and a local admin user",
		RunE: func(_ *cobra.Command, _ []string) error {
			if err := migrate(app); err != nil {
				return err
			}
			st, _ := content.LoadSettings(app)
			if cfg.Preset != "" {
				st.Preset = cfg.Preset
			}
			return runSeed(app, cfg, st.Preset, reset)
		},
	}
	seedCmd.Flags().BoolVar(&reset, "reset", false, "delete all content records first")
	cmd.AddCommand(seedCmd)
	return cmd
}

// runSeed is local-only: it refuses production and non-loopback base URLs.
func runSeed(app core.App, cfg config.Config, name string, reset bool) error {
	if cfg.Production {
		return errors.New("demo seed: refused with SITE_ENV=production")
	}
	if cfg.BaseURL != "" && !strings.Contains(cfg.BaseURL, "://localhost") && !strings.Contains(cfg.BaseURL, "://127.0.0.1") {
		return errors.New("demo seed: refused, SITE_BASE_URL is not localhost")
	}
	if !preset.Valid(name) {
		return fmt.Errorf("demo seed: unknown preset %q", name)
	}
	n, err := seed.Run(app, name, reset)
	if err != nil {
		return err
	}
	if n > 0 {
		fmt.Printf("demo seed: %d records for %s\n", n, name)
	}
	email := "admin@example.test"
	if _, err := app.FindAuthRecordByEmail("users", email); err == nil {
		return nil
	}
	pass := cfg.DemoPass
	if pass == "" {
		pass = randomPassword()
	}
	if _, err := ensureUser(app, email, "Demo admin", pass, auth.RoleAdmin, false); err != nil {
		return err
	}
	file := filepath.Join(app.DataDir(), "demo-credentials.txt")
	_ = os.WriteFile(file, []byte("cabinet: /cabinet/login\nemail: "+email+"\npassword: "+pass+"\n"), 0o600)
	fmt.Printf("demo cabinet user: %s / %s (also in %s)\n", email, pass, file)
	return nil
}

func ensureUser(app core.App, email, name, password, role string, update bool) (*core.Record, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if len(password) < 10 {
		return nil, errors.New("password must have at least 10 characters")
	}
	rec, err := app.FindAuthRecordByEmail("users", email)
	if err == nil && !update {
		return rec, nil
	}
	if err != nil {
		col, cerr := app.FindCollectionByNameOrId("users")
		if cerr != nil {
			return nil, cerr
		}
		rec = core.NewRecord(col)
		rec.SetEmail(email)
	}
	if name != "" {
		rec.Set("name", name)
	}
	rec.SetPassword(password)
	rec.SetVerified(true)
	rec.Set("role", role)
	return rec, app.Save(rec)
}

func randomPassword() string {
	b := make([]byte, 15)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
