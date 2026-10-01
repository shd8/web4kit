# web4kit

The developer CLI of a [web4](https://github.com/shd8/web4kit) site. Starters made with `pnpm create web4kit` already include it.

```bash
pnpm web4kit check                    # is the calibration profile current for my sources?
pnpm web4kit check --strict           # same, but exits with an error unless it is (for CI)
pnpm web4kit add component quote-card --shape record
```

**`check`** loads `web4/site.ts` (or `--site <path>`) and reports the configured engine's calibration:

- **active**: the profile matches every source.
- **partial**: it names the sources you edited since calibrating.
- **stale**: no source matches.
- **missing**: the engine has no profile.

It never calls the engine. Under `pnpm dev`, uncalibrated decisions are used anyway and marked *ungated in dev*. In production they fall back to rules until you run `pnpm calibrate`.

**`add component <name>`** scaffolds a component and its test in `web4/components/`: a manifest (`what`, `accepts`, `footprint`), a props schema and the markup. It then registers the component in `web4/components/index.ts`, so the planner can choose it on the next reload.

- `--shape` picks the data shape: `list`, `record` (default), `media-list`, `schedule`, `geo`, `timeseries` or `graph`.
- `--what` sets the description the model reads.

MIT
