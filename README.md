# Oliver-Apollo — Philindo operations agents

Automation for the COO of Philindo Container Express Inc.

```
LogiSys ──daily email──▶ importer/ ──▶ LogiSys Live + Archive ──▶ penny/ ──emails──▶ handlers, Ariel, COO
                                                              └──▶ Command Center (reads)
```

| Folder | What | Install |
|---|---|---|
| [`importer/`](importer/README.md) | LogiSys importer — plumbing. Writes LogiSys Live and LogiSys Archive, nothing else. | Standalone Apps Script project |
| [`penny/`](penny/README_INSTALL.md) | Penny — pending shipments agent. Owns ATA → delivered. Emails at 07:45. | Bound to the feed workbook |
| [`docs/`](docs/) | The build prompts and Penny's identity, soul and user documents | — |
| [`agos-site/`](agos-site/README.md) | Agos landing page and its sign-up Sheet script. Customers must be Agos Verified before their requirements go to lenders. | Netlify + Apps Script bound to the "Agos Sign-ups" Sheet |

Build order: importer, then Penny. Nico (billing, delivered → billed) is built separately and is
not in this repository.

## Tests

All run under Node with the Google services stubbed:

```
node penny/penny_tests.js
node importer/importer_tests.js
node agos-site/agos_tests.js
```
