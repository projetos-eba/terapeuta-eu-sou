-- Manual local fixture entrypoint. It is intentionally excluded from the
-- automatic database seed so unrelated pgTAP suites remain isolated.
\ir ../tests/fixtures/weekly-payout-local.inc
