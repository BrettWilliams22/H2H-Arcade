/** Reads `--name value` options and plain arguments from the command line. */
export function parseArgs(argv = process.argv.slice(2)): { flags: Record<string, string>; rest: string[] } {
  const flags: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[arg.slice(2)] = "true";
      } else {
        flags[arg.slice(2)] = next;
        i++;
      }
    } else {
      rest.push(arg);
    }
  }
  return { flags, rest };
}

export function intFlag(flags: Record<string, string>, name: string, fallback: number): number {
  if (flags[name] === undefined) return fallback;
  const value = Number(flags[name]);
  if (!Number.isInteger(value)) throw new Error(`--${name} must be a whole number`);
  return value;
}
