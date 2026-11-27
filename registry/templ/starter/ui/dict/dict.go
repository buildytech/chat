// Package dict embeds the UI dictionaries.
package dict

import _ "embed"

// EN is the English source dictionary.
//
//go:embed en.json
var EN []byte
