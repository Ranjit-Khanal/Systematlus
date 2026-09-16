package proc

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// SmapsRollup is /proc/<pid>/smaps_rollup — REAL kernel accounting for the whole address space.
type SmapsRollup struct {
	Rss           int64 `json:"rss_kb"`
	Pss           int64 `json:"pss_kb"`
	Anonymous     int64 `json:"anonymous_kb"`
	SharedClean   int64 `json:"shared_clean_kb"`
	SharedDirty   int64 `json:"shared_dirty_kb"`
	PrivateClean  int64 `json:"private_clean_kb"`
	PrivateDirty  int64 `json:"private_dirty_kb"`
	Swap          int64 `json:"swap_kb"`
	AnonHugePages int64 `json:"anon_huge_pages_kb"`
}

// KindBytes aggregates virtual span (from maps) by region kind.
type KindBytes struct {
	Kind       string `json:"kind"`
	Regions    int    `json:"regions"`
	VirtualKB  int64  `json:"virtual_kb"` // end-start summed (may overcount shared VA quirks; still useful)
}

// MemorySnapshot is a REAL view of a process address space at one moment.
type MemorySnapshot struct {
	PID        int            `json:"pid"`
	Phase      string         `json:"phase,omitempty"`
	PageSize   int            `json:"page_size"`
	Status     Status         `json:"status"`
	Rollup     SmapsRollup    `json:"smaps_rollup"`
	ByKind     []KindBytes    `json:"by_kind"`
	MapsSample []MapRegion    `json:"maps_sample,omitempty"`
	Note       string         `json:"note,omitempty"`
}

// ReadSmapsRollup parses /proc/<pid>/smaps_rollup.
func ReadSmapsRollup(pid int) (SmapsRollup, error) {
	f, err := os.Open(filepath.Join("/proc", strconv.Itoa(pid), "smaps_rollup"))
	if err != nil {
		return SmapsRollup{}, err
	}
	defer f.Close()

	var r SmapsRollup
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		kb := parseKB(val)
		switch key {
		case "Rss":
			r.Rss = kb
		case "Pss":
			r.Pss = kb
		case "Anonymous":
			r.Anonymous = kb
		case "Shared_Clean":
			r.SharedClean = kb
		case "Shared_Dirty":
			r.SharedDirty = kb
		case "Private_Clean":
			r.PrivateClean = kb
		case "Private_Dirty":
			r.PrivateDirty = kb
		case "Swap":
			r.Swap = kb
		case "AnonHugePages":
			r.AnonHugePages = kb
		}
	}
	return r, sc.Err()
}

// SummarizeMapsByKind sums virtual address span per maps kind.
func SummarizeMapsByKind(regions []MapRegion) []KindBytes {
	type agg struct {
		n  int
		kb int64
	}
	m := map[string]*agg{}
	order := []string{"stack", "heap", "anon", "file", "vdso", "vvar", "vsyscall"}
	for _, r := range regions {
		start, err1 := strconv.ParseUint(r.Start, 16, 64)
		end, err2 := strconv.ParseUint(r.End, 16, 64)
		if err1 != nil || err2 != nil || end <= start {
			continue
		}
		a := m[r.Kind]
		if a == nil {
			a = &agg{}
			m[r.Kind] = a
		}
		a.n++
		a.kb += int64((end - start) / 1024)
	}
	var out []KindBytes
	seen := map[string]bool{}
	for _, k := range order {
		if a, ok := m[k]; ok {
			out = append(out, KindBytes{Kind: k, Regions: a.n, VirtualKB: a.kb})
			seen[k] = true
		}
	}
	for k, a := range m {
		if !seen[k] {
			out = append(out, KindBytes{Kind: k, Regions: a.n, VirtualKB: a.kb})
		}
	}
	return out
}

// ReadMemorySnapshot gathers status + smaps_rollup + maps summary (all REAL).
func ReadMemorySnapshot(pid int, phase string, mapLimit int) (MemorySnapshot, error) {
	st, err := ReadStatus(pid)
	if err != nil {
		return MemorySnapshot{}, err
	}
	rollup, rollupErr := ReadSmapsRollup(pid)
	maps, mapsErr := ReadMaps(pid, mapLimit)
	if mapLimit <= 0 {
		mapLimit = 80
	}
	if mapsErr != nil {
		maps = nil
	}
	pageSize := os.Getpagesize()
	snap := MemorySnapshot{
		PID:        pid,
		Phase:      phase,
		PageSize:   pageSize,
		Status:     st,
		Rollup:     rollup,
		ByKind:     SummarizeMapsByKind(maps),
		MapsSample: maps,
		Note:       "Virtual addresses ≠ physical addresses. RSS is resident physical pages mapped into this process (may be shared).",
	}
	if rollupErr != nil {
		snap.Note += fmt.Sprintf(" smaps_rollup unavailable: %v", rollupErr)
	}
	return snap, nil
}

// ParseSmapsRollupText is exported for unit tests (no live /proc required).
func ParseSmapsRollupText(text string) SmapsRollup {
	var r SmapsRollup
	for _, line := range strings.Split(text, "\n") {
		key, val, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		kb := parseKB(val)
		switch key {
		case "Rss":
			r.Rss = kb
		case "Pss":
			r.Pss = kb
		case "Anonymous":
			r.Anonymous = kb
		case "Shared_Clean":
			r.SharedClean = kb
		case "Shared_Dirty":
			r.SharedDirty = kb
		case "Private_Clean":
			r.PrivateClean = kb
		case "Private_Dirty":
			r.PrivateDirty = kb
		case "Swap":
			r.Swap = kb
		case "AnonHugePages":
			r.AnonHugePages = kb
		}
	}
	return r
}
