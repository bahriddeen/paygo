// Mint activation codes (default 5):
//   node tools/license-gen/mint.ts [count]
// Each line is one code — sell one per client. Uses the same codec the app
// verifies with, so codes can never drift from verification.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { signCode } from '../../src/main/license/codec.ts'

const here = dirname(fileURLToPath(import.meta.url))
const count = Number(process.argv[2] ?? '5')
const privateKey = readFileSync(join(here, 'keys', 'private.pem'), 'utf8')

for (let i = 0; i < count; i++) {
  console.log(signCode(privateKey))
}
