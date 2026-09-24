/**
 * Master override code for activation + PIN recovery, requested explicitly
 * by the product owner despite being told it's an unpatchable, shared
 * secret extractable from any shipped install (no server-side revocation
 * is possible for a fully offline app). Single source of truth so both
 * checks can't drift.
 */
export const BACKDOOR_CODE = '20040325'

export function isBackdoorCode(input: string): boolean {
  return input.trim() === BACKDOOR_CODE
}
