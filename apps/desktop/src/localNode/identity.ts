import selfsigned from 'selfsigned'
import type { FullIdentity } from './protocol'
import { fingerprintFromPem, newDeviceId } from './protocol'
import type { EncryptedStore, SecretBox, VaultFile } from './vault'
import { createEncryptedStore } from './vault'

export interface IdentityStore {
  load(): FullIdentity | null
  loadOrCreate(name: string): FullIdentity
  rename(name: string): FullIdentity
  current(): FullIdentity | null
}

interface StoredIdentity extends FullIdentity {
  version: 1
}

function isIdentity(value: unknown): value is StoredIdentity {
  if (!value || typeof value !== 'object') return false
  const identity = value as Partial<StoredIdentity>
  return (
    identity.version === 1 &&
    typeof identity.deviceId === 'string' &&
    identity.deviceId.length >= 8 &&
    typeof identity.name === 'string' &&
    typeof identity.fingerprint === 'string' &&
    identity.fingerprint.length >= 16 &&
    typeof identity.certPem === 'string' &&
    identity.certPem.includes('BEGIN CERTIFICATE') &&
    typeof identity.keyPem === 'string' &&
    identity.keyPem.includes('PRIVATE KEY')
  )
}

function generate(name: string, now: () => Date = () => new Date()): StoredIdentity {
  const deviceId = newDeviceId()
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: deviceId }],
    {
      days: 3650,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
      ],
    },
  )
  return {
    version: 1,
    deviceId,
    name,
    fingerprint: fingerprintFromPem(pems.cert),
    certPem: pems.cert,
    keyPem: pems.private,
    createdAt: now().toISOString(),
  }
}

export function createIdentityStore(deps: {
  file: VaultFile
  secrets: SecretBox
  now?: () => Date
}): IdentityStore {
  const now = deps.now ?? (() => new Date())
  const store: EncryptedStore<StoredIdentity> = createEncryptedStore<StoredIdentity>({
    file: deps.file,
    secrets: deps.secrets,
  })
  let current: StoredIdentity | null = null

  const read = (): StoredIdentity | null => {
    if (current) return current
    const value = store.read()
    if (!isIdentity(value)) return null
    current = value
    return current
  }

  return {
    load: () => read(),

    loadOrCreate: (name) => {
      const existing = read()
      if (existing) {
        if (existing.name !== name) {
          const next = { ...existing, name }
          store.write(next)
          current = next
          return next
        }
        return existing
      }
      if (store.status() === 'unreadable') {
        throw new Error(
          'The device identity could not be decrypted. Restore the OS keychain or export a save and re-pair.',
        )
      }
      const generated = generate(name, now)
      store.write(generated)
      current = generated
      return generated
    },

    rename: (name) => {
      const existing = read()
      if (!existing) {
        if (store.status() === 'unreadable') {
          throw new Error(
            'The device identity could not be decrypted. Restore the OS keychain or export a save and re-pair.',
          )
        }
        const generated = generate(name, now)
        store.write(generated)
        current = generated
        return generated
      }
      const next = { ...existing, name }
      store.write(next)
      current = next
      return next
    },

    current: () => read(),
  }
}
