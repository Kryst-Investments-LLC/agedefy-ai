# Legal Rule Drift Alert

The nightly drift job detected one or more legal rule files that have
not been reviewed in the last **365 days**, or that fail freshness /
schema checks.

Please:

1. Run `./tools-v3/v3-jurisdiction-validator.ps1` locally.
2. Re-confirm each rule against the cited authority.
3. Update `last_reviewed:` to today's date.
4. Add a CHANGELOG entry.

Owners: @kryst-investments-llc/legal
