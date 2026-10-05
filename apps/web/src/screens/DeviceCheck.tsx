import { RULES_VERSION, verifyReplay } from "@h2h/game";
import { useEffect, useState } from "react";

interface Row {
  expected: number;
  expectedHash: number;
  got: number | null;
  gotHash: number | null;
  /** Why the replay was rejected, if it was. */
  error: string | null;
  ok: boolean;
}

function hex(hash: number | null): string {
  return hash === null ? "—" : hash.toString(16).padStart(8, "0");
}

/** Explains a failure as precisely as possible. */
function failureText(rows: Row[]): string {
  const rejected = rows.find((r) => r.error);
  if (rejected) return `FAIL: a saved game was rejected (${rejected.error}). The saved games may be out of date.`;
  if (rows.some((r) => r.got !== r.expected)) return "FAIL: this device computes different scores";
  return "FAIL: same scores, but the game state ended up different (fingerprints don't match)";
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
        const results = golden.cases.map((c): Row => {
          const checked = verifyReplay(c.replay);
          const got = checked.ok ? checked.result.score : null;
          const gotHash = checked.ok ? checked.result.hash : null;
          const ok = checked.ok && got === c.score && gotHash === c.hash;
          return { expected: c.score, expectedHash: c.hash, got, gotHash, error: checked.ok ? null : checked.error, ok };
        });
        if (!cancelled) {
          setMs(performance.now() - started);
          setRows(results);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
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
          This replays {rows?.length ?? 10} saved games on this device and checks that every score, and a fingerprint of
          the whole game state, matches what the development computer computed, down to the last point.
        </p>
        <p className={`status ${status}`} data-testid="device-check-status" data-status={status}>
          {status === "running" && "Checking…"}
          {status === "pass" && `PASS: all ${rows?.length} games matched (${Math.round(ms)} ms)`}
          {status === "fail" && (error ? `Could not run: ${error}` : failureText(rows ?? []))}
        </p>
        {rows && (
          <table className="check-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Expected</th>
                <th>This device</th>
                <th>Fingerprint</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{r.expected}</td>
                  <td>{r.got ?? "rejected"}</td>
                  <td className="mono" title={`expected ${hex(r.expectedHash)}`}>
                    {hex(r.gotHash)}
                  </td>
                  <td aria-label={r.ok ? "match" : "mismatch"}>{r.ok ? "✓" : "✗"}</td>
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
