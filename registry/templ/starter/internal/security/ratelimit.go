package security

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Limiter is a per-key sliding window (sign-in, contact form).
type Limiter struct {
	Max    int
	Window time.Duration
	Now    func() time.Time

	mu   sync.Mutex
	hits map[string][]time.Time
}

// NewLimiter allows max events per window for one key.
func NewLimiter(max int, window time.Duration) *Limiter {
	return &Limiter{Max: max, Window: window}
}

// Allow records an event for key and reports whether it is within budget.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	if l == nil {
		return true, 0
	}
	now := time.Now()
	if l.Now != nil {
		now = l.Now()
	}
	cut := now.Add(-l.Window)
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.hits == nil {
		l.hits = map[string][]time.Time{}
	}
	if len(l.hits) > 10000 { // bound memory under a flood
		for k, q := range l.hits {
			if len(q) == 0 || !q[len(q)-1].After(cut) {
				delete(l.hits, k)
			}
		}
	}
	q := l.hits[key]
	i := 0
	for i < len(q) && !q[i].After(cut) {
		i++
	}
	q = q[i:]
	if len(q) >= l.Max {
		l.hits[key] = q
		return false, q[0].Add(l.Window).Sub(now)
	}
	l.hits[key] = append(q, now)
	return true, 0
}

// RetryAfter writes the Retry-After header in whole seconds.
func RetryAfter(w http.ResponseWriter, d time.Duration) {
	s := int(d.Seconds())
	if s < 1 {
		s = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(s))
}
