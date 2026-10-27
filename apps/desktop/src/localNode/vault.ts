import path from 'node:path'

export interface VaultFile {
  read(): string | null
  write(value: string): void
  remove(): void
}

export interface VaultFs {
  readFileSync(filePath: string, encoding: 'utf8'): string
  mkdirSync(dirPath: string, options: { recursive: true }): void
  writeFileSync(filePath: string, data: string, options: { mode: number }): void
  chmodSync(filePath: string, mode: number): void
  renameSync(from: string, to: string): void
  rmSync(filePath: string, options: { force: true }): void
}

/** Atomic, private file: temp file in the same directory, then rename. */
export function createVaultFile(
  vaultPath: string,
  fs: VaultFs,
  nextTempPath: (vaultPath: string) => string = (target) =>
    `${target}.${process.pid}.${Date.now()}.tmp`,
): VaultFile {
  const read = (): string | null => {
    try {
      return fs.readFileSync(vaultPath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  const write = (value: string): void => {
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true })
    const temp = nextTempPath(vaultPath)
    try {
      fs.writeFileSync(temp, value, { mode: 0o600 })
      fs.chmodSync(temp, 0o600)
      fs.renameSync(temp, vaultPath)
    } catch (error) {
      try {
        fs.rmSync(temp, { force: true })
      } catch {
        // Keep the original write error.
      }
      throw error
    }
  }

  return {
    read,
    write,
    remove: () => fs.rmSync(vaultPath, { force: true }),
  }
}

export interface SecretBox {
  available: boolean
  encrypt(value: string): string
  decrypt(value: string): string
}

interface Envelope {
  v: 1
  encrypted: boolean
  payload: string
}

export type StoreStatus = 'missing' | 'ok' | 'unreadable'

export interface EncryptedStore<T> {
  read(): T | null
  write(value: T): void
  remove(): void
  encrypted(): boolean
  status(): StoreStatus
}

/**
 * JSON store whose payload is encrypted with the OS keychain when available.
 * If encryption is unavailable the file is still written with mode 0600 and a
 * visible warning in the UI; losing the device key is recoverable by pairing
 * again, never by silently overwriting a save.
 */
export function createEncryptedStore<T>(deps: {
  file: VaultFile
  secrets: SecretBox
}): EncryptedStore<T> {
  const { file, secrets } = deps
  // The current capability is what the UI reports; a read may still encounter
  // an older plaintext file and the next write re-encrypts it.
  let usedEncryption = secrets.available
  let readStatus: StoreStatus = 'missing'

  const read = (): T | null => {
    let raw: string | null
    try {
      raw = file.read()
    } catch {
      readStatus = 'unreadable'
      return null
    }
    if (!raw) {
      readStatus = 'missing'
      return null
    }
    try {
      const envelope = JSON.parse(raw) as Partial<Envelope>
      if (envelope.v !== 1 || typeof envelope.payload !== 'string') {
        readStatus = 'unreadable'
        return null
      }
      const json = envelope.encrypted
        ? secrets.available
          ? secrets.decrypt(envelope.payload)
          : null
        : envelope.payload
      if (json === null) {
        readStatus = 'unreadable'
        return null
      }
      usedEncryption = envelope.encrypted === true
      const value = JSON.parse(json) as T
      readStatus = 'ok'
      return value
    } catch {
      // A keychain reset or a corrupt file must never crash the app; callers
      // must keep the old file and surface a recoverable error.
      readStatus = 'unreadable'
      return null
    }
  }

  const write = (value: T): void => {
    const json = JSON.stringify(value)
    let envelope: Envelope
    if (secrets.available) {
      try {
        envelope = { v: 1, encrypted: true, payload: secrets.encrypt(json) }
        usedEncryption = true
      } catch {
        envelope = { v: 1, encrypted: false, payload: json }
        usedEncryption = false
      }
    } else {
      envelope = { v: 1, encrypted: false, payload: json }
      usedEncryption = false
    }
    file.write(JSON.stringify(envelope))
  }

  return {
    read,
    write,
    remove: () => file.remove(),
    encrypted: () => usedEncryption,
    status: () => readStatus,
  }
}
