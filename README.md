# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/shunnosukeAI/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/shunnosukeAI/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in replacement for csv-reader 1.0.0, make.fun's reference CSV reader. `solve.js` is a dependency-free ES module whose `run(input)` returns csv-reader's exact answer — the JSON value {columns, rows, errors} — for every input {text, header}, including every broken-row case (stray CRs, quote junk, unterminated quotes, short and long rows, with csv-reader's error records in csv-reader's order). Where the reference reads one character at a time, this reader slices whole runs of ordinary characters at once: unquoted fields are scanned by a tight character loop that stops at the field's own delimiters, and quoted fields are located with indexOf and normalized in bulk. `main.ts` is the driver the harness runs.

## Run it

```sh
node main.ts
```

It reads every case from /input/cases.json (a JSON array of {id, input}), answers each with run, and writes /output/answers.json. Outside a container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand in for /input and /output.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4vexb5f4&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
