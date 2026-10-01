import { benchView } from "@/lib/bench";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The dataset's splits and the leaderboard, from the files committed in bench/ (build time). */
export function BenchLeaderboard() {
  const { dataset, entries } = benchView();
  return (
    <div className="flex flex-col gap-6" data-bench={dataset.version}>
      <table data-bench-splits="">
        <thead>
          <tr>
            <th>Split</th>
            <th>Sites</th>
            <th>Items</th>
            <th>Labels</th>
          </tr>
        </thead>
        <tbody>
          {(["dev", "test"] as const).map((split) => {
            const s = dataset.splits[split];
            return (
              <tr key={split}>
                <td>
                  <code>{split}</code>
                </td>
                <td>{s.sites.map((k) => dataset.sites[k]?.title ?? k).join(", ")}</td>
                <td>{s.items}</td>
                <td>{s.labels.toLocaleString("en")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-sm text-fd-muted-foreground">
        Dataset <code>{dataset.version}</code>, content hash{" "}
        <code>{dataset.contentHash.slice(0, 12)}</code>.
      </p>
      <table data-bench-leaderboard="">
        <thead>
          <tr>
            <th>Engine</th>
            <th>Test decision</th>
            <th>Test raw</th>
            <th>Test invariants</th>
            <th>Dev decision</th>
            <th>Open, small</th>
            <th>Answers</th>
            <th>Challenge</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ entry, small, meets }) => {
            const m = entry.score.submission;
            const t = entry.score.splits.test;
            return (
              <tr key={entry.id} data-bench-entry={entry.id}>
                <td>
                  <code>{m.engineVersion}</code>
                </td>
                <td>{pct(t.decisionAccuracy)}</td>
                <td>{pct(t.rawAccuracy)}</td>
                <td>{pct(t.invariantPassRate)}</td>
                <td>{pct(entry.score.splits.dev.decisionAccuracy)}</td>
                <td>{small ? `yes (${m.weightsGB} GB)` : "no"}</td>
                <td data-bench-published={String(entry.published)}>
                  {entry.published
                    ? "published, re-scored in CI"
                    : `reported only, ${entry.measuredAt.slice(0, 10)}`}
                </td>
                <td>{meets ? "✓ meets it" : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
