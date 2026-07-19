import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tag = process.argv[2]
const version = tag?.startsWith('v') ? tag.slice(1) : ''
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

if (!semver.test(version)) {
  throw new Error('Pass a release tag in the form v<semver>, for example v0.2.1.')
}

const [packageJson, tauriConfig, cargoToml] = await Promise.all([
  readFile(path.join(root, 'package.json'), 'utf8'),
  readFile(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
  readFile(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8'),
])

const versions = {
  'package.json': JSON.parse(packageJson).version,
  'src-tauri/tauri.conf.json': JSON.parse(tauriConfig).version,
  'src-tauri/Cargo.toml': cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
}

const mismatches = Object.entries(versions)
  .filter(([, configuredVersion]) => configuredVersion !== version)
  .map(([file, configuredVersion]) => `${file} is ${configuredVersion ?? 'missing'}`)

if (mismatches.length > 0) {
  throw new Error(`Release tag v${version} does not match configured versions: ${mismatches.join(', ')}.`)
}

console.log(`Release version v${version} verified.`)
