# Contributing

Use Issues for reproducible bugs or feature requests. Search existing reports first. English and Chinese reports are welcome. Do not include names, addresses, order numbers, cookies, account identifiers, payment details or private cart screenshots.

Fork this repository and open a focused pull request against `main`. Include the problem, the behavior after the change and relevant validation. Run the commands in the README. Use fixtures for merchant tests; do not make purchases or run paid source collection in CI.

`@Su1System` is the maintainer and code owner. External PRs need at least one current code-owner approval, passing `validate` checks and resolved conversations. New commits dismiss stale approvals. Contributors do not receive repository write access just by opening a PR. Auto-merge is disabled. The repository settings must enforce these rules; the CODEOWNERS file alone is not a merge restriction.

Changes to permissions, data handling, coupon sources, monetization, dependencies and workflows need explicit maintainer review. Do not add affiliate substitution, browsing-history collection, hidden telemetry, remote executable code, or embedded credentials.

Only a maintainer can initiate a package candidate. Publishing GitHub releases and submitting to Chrome Web Store are separate maintainer actions after reviewing the exact artifact. An outside PR never triggers publishing or receives deployment credentials.

If the sole maintainer authors a PR, GitHub does not count their own approval. Use another trusted reviewer when available, or record a deliberate repository-owner exception; do not pretend an automated check is an independent human approval.

Contributions are licensed under the project's MIT license. Describe third-party material and its license when adding it.
