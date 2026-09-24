/** Unix seconds for local midnight of the day containing `nowSec`. */
export function startOfDaySec(nowSec: number): number {
  const d = new Date(nowSec * 1000)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}
