package expo.modules.lifespirelan

import android.content.Context
import java.security.MessageDigest

class PeerStore(context: Context) {
  private val prefs = SecretPrefs(context.applicationContext)
  private var cache: MutableList<StoredPeer>? = null

  val encrypted: Boolean
    get() = prefs.encrypted

  @Synchronized
  private fun load(): MutableList<StoredPeer> {
    cache?.let { return it }
    val peers = peersFromJson(prefs.prefs.getString("peers", null))
    cache = peers
    return peers
  }

  @Synchronized
  private fun save(): Unit {
    prefs.prefs.edit().putString("peers", peersToJson(load())).apply()
  }

  @Synchronized
  fun list(): List<PeerRecord> = load().map {
    PeerRecord(
      peerId = it.peerId,
      name = it.name,
      fingerprint = it.fingerprint,
      autoSync = it.autoSync,
      pairedAt = it.pairedAt,
      lastSyncAt = it.lastSyncAt,
    )
  }

  @Synchronized
  fun stored(): List<StoredPeer> = load().map { it.copy() }

  @Synchronized
  fun find(peerId: String): StoredPeer? = load().firstOrNull { it.peerId == peerId }

  @Synchronized
  fun findByToken(token: String): StoredPeer? {
    if (token.isEmpty()) return null
    return load().firstOrNull { sameToken(it.token, token) }
  }

  @Synchronized
  fun upsert(peer: StoredPeer) {
    val current = load()
    val index = current.indexOfFirst { it.peerId == peer.peerId }
    if (index == -1) current.add(peer) else current[index] = peer
    save()
  }

  @Synchronized
  fun update(peerId: String, transform: (StoredPeer) -> StoredPeer): StoredPeer? {
    val current = load()
    val index = current.indexOfFirst { it.peerId == peerId }
    if (index == -1) return null
    val next = transform(current[index])
    current[index] = next
    save()
    return next
  }

  @Synchronized
  fun remove(peerId: String) {
    val current = load()
    current.removeAll { it.peerId == peerId }
    save()
  }

  @Synchronized
  fun setAutoSync(peerId: String, autoSync: Boolean): PeerRecord? =
    update(peerId) { it.copy(autoSync = autoSync) }?.let {
      PeerRecord(it.peerId, it.name, it.fingerprint, it.autoSync, it.pairedAt, it.lastSyncAt)
    }

  @Synchronized
  fun touch(peerId: String, lastHost: String? = null, lastPort: Int? = null, lastSyncAt: String? = null) {
    update(peerId) {
      it.copy(
        lastHost = lastHost ?: it.lastHost,
        lastPort = lastPort ?: it.lastPort,
        lastSyncAt = lastSyncAt ?: it.lastSyncAt,
      )
    }
  }

  private fun sameToken(left: String, right: String): Boolean {
    val a = left.toByteArray()
    val b = right.toByteArray()
    if (a.size != b.size) return false
    return MessageDigest.isEqual(a, b)
  }
}
