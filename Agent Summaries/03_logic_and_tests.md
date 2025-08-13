# Agent Summary — 03 Logic and Unit Tests

Exports implemented in `server/logic.js`:
- `COLOR_TO_RANGE_NM`, `PREFERRED_FLUOR_EMISSIONS`
- `mapFluorophoreNameToEmission(name)`
- `matchSecondaries(primaries, secondaries, colorSelections)`
- `unifySerumHosts(chosenSecondaries)`
- `calcBlockingVolumes(S, hosts)`
- `calcPrimaryMix(S, primariesWithDilutions)`
- `calcSecondaryMix(S, secondariesWithStocks)`

Notes/assumptions:
- Ig compatibility: `IgG` (no subclass) is a wildcard matching any `IgG*`. Exact subclass matches otherwise, different subclasses incompatible.
- Color synonyms accepted: `far red`, `far-red`, `farred`.
- Volume math: do integer µL math, round totals to whole mL, then recompute components to sum exactly. Primary diluent split 10% Blocking / 90% PBST.
- Secondary stock volumes use `V_mL / C_stock` (mg/mL), assuming `1 mg/mL` when missing.

Unit tests added in `server/__tests__/logic.test.js` covering:
- Color/fluor mapping basics
- `matchSecondaries()` host + IgG wildcard + color range
- `unifySerumHosts()` single vs two hosts and >2 warning
- `calcBlockingVolumes()` rounding and serum split
- `calcPrimaryMix()` multiple primaries, stock subtraction, diluent split
- `calcSecondaryMix()` stock µL and PBST remainder

All tests pass with `npm test`.


