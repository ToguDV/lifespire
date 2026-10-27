import path from 'node:path'
import type { IncomingDocument } from './protocol'

export interface InboxItem extends IncomingDocument {
  receivedAt: string
}

interface InboxFs {
  readdirSync(dirPath: string): string[]
  readFileSync(filePath: string, encoding: 'utf8'): string
  writeFileSync(filePath: string, data: string, options: { mode: number }): void
  mkdirSync(dirPath: string, options: { recursive: true }): void
  renameSync(from: string, to: string): void
  rmSync(filePath: string, options: { force: true }): void
}

export interface Inbox {
  list(): InboxItem[]
  add(item: IncomingDocument): InboxItem
  ack(id: string, ok: boolean): void
}

function safeId(value: string): string {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : ''
}

/**
 * Durable incoming-document queue. A peer receives a 202 only after the raw
 * document is on disk; the renderer drains the queue and acks. A crash between
 * both steps re-delivers on the next start instead of losing the write.
 */
export function createInbox(deps: { dir: string; fs: InboxFs; now?: () => Date }): Inbox {
  const now = deps.now ?? (() => new Date())
  const { dir, fs } = deps

  const ensure = (): void => {
    fs.mkdirSync(dir, { recursive: true })
  }

  const fileFor = (id: string): string => path.join(dir, `${id}.json`)

  const list = (): InboxItem[] => {
    ensure()
    const items: InboxItem[] = []
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.json')) continue
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8')) as Partial<InboxItem>
        if (
          typeof parsed.id === 'string' &&
          typeof parsed.fromPeerId === 'string' &&
          typeof parsed.documentJson === 'string' &&
          typeof parsed.docHash === 'string' &&
          typeof parsed.updatedAt === 'string'
        ) {
          items.push({
            id: parsed.id,
            fromPeerId: parsed.fromPeerId,
            documentJson: parsed.documentJson,
            docHash: parsed.docHash,
            updatedAt: parsed.updatedAt,
            receivedAt: typeof parsed.receivedAt === 'string' ? parsed.receivedAt : parsed.updatedAt,
          })
        }
      } catch {
        // A corrupt inbox entry is kept on disk for diagnosis, never applied.
      }
    }
    return items.sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))
  }

  return {
    list,

    add: (item) => {
      const id = safeId(item.id)
      if (!id) throw new Error('Invalid inbox id.')
      ensure()
      const stored: InboxItem = { ...item, id, receivedAt: now().toISOString() }
      fs.writeFileSync(fileFor(id), JSON.stringify(stored), { mode: 0o600 })
      return stored
    },

    ack: (id, ok) => {
      const safe = safeId(id)
      if (!safe) return
      const file = fileFor(safe)
      if (ok) {
        fs.rmSync(file, { force: true })
        return
      }
      const quarantine = path.join(dir, 'quarantine')
      try {
        fs.mkdirSync(quarantine, { recursive: true })
        fs.renameSync(file, path.join(quarantine, `${safe}.json`))
      } catch {
        // Keeping the rejected item in place is safer than deleting it.
      }
    },
  }
}
