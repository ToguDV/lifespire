package expo.modules.lifespirelan

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.util.UUID

class LanInbox(context: Context) {
  private val directory = File(context.applicationContext.filesDir, "lifespire-lan-inbox")

  private fun ensure() {
    if (!directory.exists()) directory.mkdirs()
  }

  private fun safeId(id: String): String? =
    if (Regex("^[A-Za-z0-9_-]{8,128}$").matches(id)) id else null

  @Synchronized
  fun list(): List<IncomingDocument> {
    ensure()
    val items = mutableListOf<IncomingDocument>()
    val files = directory.listFiles { file -> file.isFile && file.name.endsWith(".json") } ?: return items
    for (file in files) {
      try {
        val json = JSONObject(file.readText())
        val id = json.optString("id", "")
        val documentJson = json.optString("documentJson", "")
        if (id.isEmpty() || documentJson.isEmpty()) continue
        items.add(
          IncomingDocument(
            id = id,
            fromPeerId = json.optString("fromPeerId", ""),
            documentJson = documentJson,
            docHash = json.optString("docHash", ""),
            updatedAt = json.optString("updatedAt", nowIso()),
            receivedAt = json.optString("receivedAt", nowIso()),
          ),
        )
      } catch (_: Exception) {
        // A corrupt entry stays on disk for diagnosis and is never applied.
      }
    }
    return items.sortedBy { it.receivedAt }
  }

  @Synchronized
  fun add(fromPeerId: String, documentJson: String, docHash: String, updatedAt: String): IncomingDocument {
    ensure()
    val item = IncomingDocument(
      id = UUID.randomUUID().toString(),
      fromPeerId = fromPeerId,
      documentJson = documentJson,
      docHash = docHash,
      updatedAt = updatedAt,
      receivedAt = nowIso(),
    )
    val target = File(directory, "${item.id}.json")
    val temp = File(directory, "${item.id}.tmp")
    temp.writeText(
      JSONObject().apply {
        put("id", item.id)
        put("fromPeerId", item.fromPeerId)
        put("documentJson", item.documentJson)
        put("docHash", item.docHash)
        put("updatedAt", item.updatedAt)
        put("receivedAt", item.receivedAt)
      }.toString(),
    )
    if (!temp.renameTo(target)) {
      target.writeText(temp.readText())
      temp.delete()
    }
    return item
  }

  @Synchronized
  fun find(id: String): IncomingDocument? =
    safeId(id)?.let { safe -> list().firstOrNull { it.id == safe } }

  @Synchronized
  fun ack(id: String, ok: Boolean) {
    val safe = safeId(id) ?: return
    val file = File(directory, "$safe.json")
    if (!file.exists()) return
    if (ok) {
      file.delete()
      return
    }
    val quarantine = File(directory, "quarantine")
    if (!quarantine.exists()) quarantine.mkdirs()
    val target = File(quarantine, "$safe.json")
    if (!file.renameTo(target)) {
      // Keeping the rejected item in place is safer than deleting it.
    }
  }
}
