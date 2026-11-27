// Package auth signs cabinet users in with email and password checked in Go
// (the PocketBase users auth API is disabled by migration) and keeps the
// session in an HttpOnly cookie holding a PocketBase auth token.
package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"golang.org/x/crypto/bcrypt"
)

// Cookie is the session cookie name.
const Cookie = "site_session"

// Roles.
const (
	RoleAdmin  = "admin"
	RoleEditor = "editor"
)

// ErrInvalid is the one sign-in error (no hint whether the email exists).
var ErrInvalid = errors.New("auth: wrong email or password")

// dummy keeps the timing of unknown emails close to a real check.
var dummy, _ = bcrypt.GenerateFromPassword([]byte("timing-equalizer"), bcrypt.DefaultCost)

// SignIn checks the credentials of a cabinet user (role admin or editor).
func SignIn(app core.App, email, password string) (*core.Record, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	rec, err := app.FindAuthRecordByEmail("users", email)
	if err != nil || rec == nil {
		_ = bcrypt.CompareHashAndPassword(dummy, []byte(password))
		return nil, ErrInvalid
	}
	if !rec.ValidatePassword(password) || !HasRole(rec) {
		return nil, ErrInvalid
	}
	return rec, nil
}

// HasRole reports whether the user may use the cabinet.
func HasRole(rec *core.Record) bool {
	r := rec.GetString("role")
	return r == RoleAdmin || r == RoleEditor
}

// IsAdmin reports whether the user has the admin role.
func IsAdmin(rec *core.Record) bool { return rec != nil && rec.GetString("role") == RoleAdmin }

// Issue writes the session cookie.
func Issue(w http.ResponseWriter, rec *core.Record, secure bool) error {
	token, err := rec.NewAuthToken()
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: Cookie, Value: token, Path: "/", HttpOnly: true, Secure: secure,
		SameSite: http.SameSiteLaxMode, MaxAge: int(rec.Collection().AuthToken.Duration),
	})
	return nil
}

// Current returns the signed-in cabinet user, or nil.
func Current(app core.App, r *http.Request) *core.Record {
	c, err := r.Cookie(Cookie)
	if err != nil || c.Value == "" {
		return nil
	}
	rec, err := app.FindAuthRecordByToken(c.Value, core.TokenTypeAuth)
	if err != nil || rec == nil || rec.Collection().Name != "users" || !HasRole(rec) {
		return nil
	}
	return rec
}

// SignOut clears the cookie and rotates the token key, so the old token
// (and every other session of the user) stops working.
func SignOut(app core.App, w http.ResponseWriter, rec *core.Record, secure bool) {
	http.SetCookie(w, &http.Cookie{Name: Cookie, Value: "", Path: "/", HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	if rec != nil {
		rec.RefreshTokenKey()
		_ = app.Save(rec)
	}
}
