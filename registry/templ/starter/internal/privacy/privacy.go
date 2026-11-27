// Package privacy holds the switches that decide what the server may write
// about visitors. The site is built like a static site: public pages set no
// cookies, accept no posts and load nothing from other hosts, so it needs no
// consent banner. The only visitor data a server could still write is the
// request log, controlled here by SITE_ACCESS_LOG (default off). Every
// place data can be written is listed in PRIVACY.md.
package privacy

import (
	"github.com/pocketbase/pocketbase/core"

	"github.com/fastygo/starter/internal/config"
)

// Retention in days per access log mode.
const (
	AnonDays = 3
	FullDays = 7
)

// ApplyLogSettings sets PocketBase's own request log (_logs in
// auxiliary.db) for mode. It runs on every start, so a change made in the
// admin UI does not survive a restart:
//
//	off  - MaxDays 0: PocketBase writes no logs at all (no requests, no IPs)
//	anon - request logs for AnonDays, without IPs and user ids
//	full - request logs for FullDays, with client IPs (needs a legal basis)
func ApplyLogSettings(app core.App, mode string) error {
	s := app.Settings()
	s.Logs.LogAuthId = false
	switch mode {
	case config.AccessLogFull:
		s.Logs.MaxDays, s.Logs.LogIP = FullDays, true
	case config.AccessLogAnon:
		s.Logs.MaxDays, s.Logs.LogIP = AnonDays, false
	default:
		s.Logs.MaxDays, s.Logs.LogIP = 0, false
	}
	return app.Save(s)
}
