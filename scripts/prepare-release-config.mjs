import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localPublicKeyPath = path.join(root, '.secrets', 'codex-skin-studio-updater.key.pub')
const localPublicKey = await readFile(localPublicKeyPath, 'utf8')
  .then((value) => value.trim())
  .catch(() => undefined)
const publicKey = process.env.TAURI_UPDATER_PUBKEY?.trim() || localPublicKey
const endpoint = (
  process.env.TAURI_UPDATE_ENDPOINT
  ?? 'https://github.com/pojianbing/CodexSkinStudio/releases/latest/download/latest.json'
).trim()
const macosSigningIdentity = process.env.TAURI_MACOS_SIGNING_IDENTITY?.trim() || '-'

if (!publicKey) {
  throw new Error('TAURI_UPDATER_PUBKEY is required, or create .secrets/codex-skin-studio-updater.key.pub first.')
}

if (!endpoint.startsWith('https://')) {
  throw new Error('TAURI_UPDATE_ENDPOINT must use HTTPS.')
}

const releaseConfig = {
  bundle: {
    createUpdaterArtifacts: true,
    macOS: {
      signingIdentity: macosSigningIdentity,
    },
  },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: [endpoint],
      windows: {
        installMode: 'passive',
      },
    },
  },
}

const configPath = path.join(root, 'src-tauri', 'tauri.release.conf.json')
await mkdir(path.dirname(configPath), { recursive: true })
await writeFile(configPath, `${JSON.stringify(releaseConfig, null, 2)}\n`, 'utf8')

console.log(`Prepared release updater configuration for ${new URL(endpoint).host}.`)
