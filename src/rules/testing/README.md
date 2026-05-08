# Testing Rules

This folder owns rules that catch test-hygiene issues before they ship.

The rules cover `.skip`/`.only`/`xit`/`xdescribe` markers, example-only
suites that lack a property/invariant test, hardcoded literal assertions,
coverage-threshold gates that mask regressions, and `vi.mock` inside
integration-test files.

New rules belong here when the smell is about how the test suite reasons
about behavior, not about the production code under test.
