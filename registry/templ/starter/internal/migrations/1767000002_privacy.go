package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Contact button looks. They match the UI8Kit link-button recipe
// (ui/kit/compose: variant default|secondary|outline, size sm|default|lg).
var (
	ButtonVariants = []string{"default", "secondary", "outline"}
	ButtonSizes    = []string{"sm", "default", "lg"}
)

func init() {
	m.Register(upPrivacy, downPrivacy)
}

// upPrivacy makes the site collect nothing from visitors: the leads
// collection of early development databases is dropped (new databases never
// had it), and the one contact button becomes configurable instead.
func upPrivacy(app core.App) error {
	if leads, err := app.FindCollectionByNameOrId("leads"); err == nil {
		if err := app.Delete(leads); err != nil {
			return err
		}
	}
	settings, err := app.FindCollectionByNameOrId("settings")
	if err != nil {
		return err
	}
	settings.Fields.Add(
		&core.SelectField{Name: "contact_variant", MaxSelect: 1, Values: ButtonVariants},
		&core.SelectField{Name: "contact_size", MaxSelect: 1, Values: ButtonSizes},
		&core.BoolField{Name: "contact_new_window"},
	)
	return app.Save(settings)
}

func downPrivacy(app core.App) error {
	settings, err := app.FindCollectionByNameOrId("settings")
	if err != nil {
		return err
	}
	for _, f := range []string{"contact_variant", "contact_size", "contact_new_window"} {
		settings.Fields.RemoveByName(f)
	}
	return app.Save(settings)
}
