/**
 * One CLI reader for the whole pipeline. There were four different ones before
 * — two copies of this function, a positional-pair loop and an `argv.find` over
 * the preceding element — so the same `--flag value` invocation behaved
 * differently depending on which script you ran.
 */
export function arg(name: string, argv: string[] = process.argv.slice(2)): string | undefined {
  const index = argv.indexOf(`--${name}`)
  if (index === -1) return undefined
  const value = argv[index + 1]
  // A flag followed by another flag has no value, rather than swallowing it.
  return value === undefined || value.startsWith('--') ? undefined : value
}

export function requireArg(name: string, usage: string): string {
  const value = arg(name)
  if (value === undefined) throw new Error(`не задан --${name}\n${usage}`)
  return value
}
