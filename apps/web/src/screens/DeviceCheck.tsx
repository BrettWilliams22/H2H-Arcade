import { RULES_VERSION, verifyReplay } from "@h2h/game";
import { useEffect, useState } from "react";

interface Row {
  expected: number;
  got: number | null;
  ok: boolean;
}

/**
 * Replays the saved "golden" games on this device and compares the scores with
 * the ones computed on the development computer. If they all match, this
 * browser computes scores exactly like the server will.
 */
export function DeviceCheck({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ms, setMs] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("@h2h/game/fixtures/golden.json")
      .then((mod) => {
        const golden = mod.default as { cases: { score: number; hash: number; replay: unknown }[] };
        const started = performance.now();
        const results = golden.cases.map((c) => {
          const checked = verifyReplay(c.replay);
          const got = checked.ok ? checked.result.score : null;
          const ok = checked.ok && checked.result.score === c.score && checked.result.hash === c.hash;
          return { expected: c.score, got, ok };
        });
        if (!cancelled) {
          setMs(performance.now() - started);
          setRows(results);
        }
      })
      .catch((e: unknown) => setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const allOk = rows !== null && rows.length > 0 && rows.every((r) => r.ok);
  const status = rows === null ? (error ? "fail" : "running") : allOk ? "pass" : "fail";

  return (
    <div className="screen menu-screen">
      <div className="panel prose">
        <h2>DEVICE CHECK</h2>
        <p>
          This replays {rows?.length ?? 10} saved games on this device and checks that every score matches the score
          computed on the development computer, down to the last point.
        </p>
        <p className={`status ${status}`} data-testid="device-check-status" data-status={status}>
          {status === "running" && "Checking…"}
          {status === "pass" && `PASS: all ${rows?.length} games matched (${Math.round(ms)} ms)`}
          {status === "fail" && (error ? `Could not run: ${error}` : "FAIL: this device computes different scores")}
        </p>
        {rows && (
          <table className="check-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Expected</th>
                <th>This device</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{r.expected}</td>
                  <td>{r.got ?? "rejected"}</td>
                  <td>{r.ok ? "✓" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="fine">
          Rules version {RULES_VERSION} · {navigator.userAgent}
        </p>
        <button type="button" className="btn primary" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  );
}
