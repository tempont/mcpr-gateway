let _isDemoMode = false

/** Returns true when DEMO_MODE is active, after setDemoMode() was called at startup. */
export function isDemoMode(): boolean {
  return _isDemoMode
}

/** Must be called once at startup from src/index.ts before any routes are registered. */
export function setDemoMode(value: boolean): void {
  _isDemoMode = value
}
