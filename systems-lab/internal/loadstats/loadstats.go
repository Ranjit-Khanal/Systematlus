package loadstats

import "sort"

// Percentile returns the p-th percentile (0–100) of values. Empty → 0.
func Percentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	cp := append([]float64(nil), values...)
	sort.Float64s(cp)
	if p <= 0 {
		return cp[0]
	}
	if p >= 100 {
		return cp[len(cp)-1]
	}
	idx := int(float64(len(cp)-1) * p / 100.0)
	return cp[idx]
}

// Summarize computes basic latency stats. Errors are counted separately.
func Summarize(okLatencies []float64, errN int, wallSec float64) map[string]float64 {
	cp := append([]float64(nil), okLatencies...)
	sort.Float64s(cp)
	var sum float64
	for _, v := range cp {
		sum += v
	}
	avg := 0.0
	if len(cp) > 0 {
		avg = sum / float64(len(cp))
	}
	rps := 0.0
	if wallSec > 0 {
		rps = float64(len(cp)) / wallSec
	}
	return map[string]float64{
		"ok":     float64(len(cp)),
		"err":    float64(errN),
		"avg_ms": avg,
		"p50_ms": Percentile(cp, 50),
		"p95_ms": Percentile(cp, 95),
		"p99_ms": Percentile(cp, 99),
		"max_ms": Percentile(cp, 100),
		"rps":    rps,
	}
}
