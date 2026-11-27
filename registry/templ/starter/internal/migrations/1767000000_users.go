// Package migrations holds the Go migrations. The schema changes only here:
// never click a collection or a field in the admin UI, because the next
// deploy would not know about it. Every collection has nil API rules
// (superuser only); public pages read records server-side in Go handlers.
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(upUsers, nil)
}

// Roles of cabinet users. The PocketBase superuser is a separate account
// (the _superusers collection) used only in the admin UI behind a tunnel.
const (
	RoleAdmin  = "admin"
	RoleEditor = "editor"
)

// upUsers locks the default users collection: no public sign-up, no
// PocketBase auth API (the cabinet checks passwords in Go), and adds role.
func upUsers(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.ListRule, users.ViewRule, users.CreateRule, users.UpdateRule, users.DeleteRule = nil, nil, nil, nil, nil
	users.PasswordAuth.Enabled = false
	users.OTP.Enabled = false
	users.MFA.Enabled = false
	users.OAuth2.Enabled = false
	if users.Fields.GetByName("role") == nil {
		users.Fields.Add(&core.SelectField{Name: "role", MaxSelect: 1, Values: []string{RoleAdmin, RoleEditor}})
	}
	return app.Save(users)
}
