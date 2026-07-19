import { access, mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const secretsDirectory = path.join(root, '.secrets')
const privateKeyPath = path.join(secretsDirectory, 'codex-skin-studio-updater.key')
const publicKeyPath = `${privateKeyPath}.pub`

const exists = async (file) => access(file).then(() => true).catch(() => false)

if (await exists(privateKeyPath) || await exists(publicKeyPath)) {
  throw new Error(`Updater key already exists in ${secretsDirectory}. Refusing to overwrite it.`)
}

await mkdir(secretsDirectory, { recursive: true })

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['tauri', 'signer', 'generate', '--write-keys', privateKeyPath], {
  cwd: root,
  stdio: 'inherit',
})

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

if (!(await exists(privateKeyPath)) || !(await exists(publicKeyPath))) {
  throw new Error('Tauri did not produce both updater key files.')
}

console.log(`Generated updater keypair in ${secretsDirectory}.`)
