package expo.modules.lifespirelan

import android.content.Context
import org.json.JSONObject

class LanManager(
  context: Context,
  private val emitPeers: (List<NearbyPeer>) -> Unit,
  private val emitPaired: (PeerRecord) -> Unit,
  private val emitIncoming: (IncomingDocument) -> Unit,
  private val emitError: (String) -> Unit,
) {
  private val appContext = context.applicationContext
  private val client = PinnedClient()
  private var identityStore: IdentityStore? = null
  private var identity: Identity? = null
  private var peers: PeerStore? = null
  private var inbox: LanInbox? = null
  private var server: LanServer? = null
  private var discovery: LanDiscovery? = null
  private var discoverable = false

  fun start(options: Map<String, Any?>): Map<String, Any?> {
    identity?.let { return it.toDeviceIdentity().toMap() }
    val name = sanitizeName(options["name"] as? String, "Android device")
    discoverable = options["discoverable"] as? Boolean ?: false
    val store = IdentityStore(appContext)
    val loaded = store.loadOrCreate(name)
    val peerStore = PeerStore(appContext)
    val inboxStore = LanInbox(appContext)
    val localServer = LanServer(
      context = appContext,
      identity = loaded,
      peers = peerStore,
      inbox = inboxStore,
      onIncoming = { item -> emitIncoming(item) },
      onPaired = { peer -> emitPaired(peer) },
      onError = emitError,
    )
    inboxStore.list().firstOrNull()?.let { pending ->
      localServer.setPendingMirror(
        Mirror(pending.documentJson, pending.docHash, pending.updatedAt),
      )
    }
    val port = localServer.startServer()
    val lanDiscovery = LanDiscovery(
      context = appContext,
      identity = loaded.toDeviceIdentity(),
      discoverable = discoverable,
      onPeers = emitPeers,
      onError = emitError,
    )
    lanDiscovery.start(port)
    identityStore = store
    identity = loaded
    peers = peerStore
    inbox = inboxStore
    server = localServer
    discovery = lanDiscovery
    return loaded.toDeviceIdentity().toMap()
  }

  fun stop() {
    discovery?.stop()
    discovery = null
    server?.stopServer()
    server = null
    identity = null
    identityStore = null
    peers = null
    inbox = null
  }

  fun setDiscoverable(value: Boolean): Boolean {
    discoverable = value
    discovery?.setDiscoverable(value)
    return discoverable
  }

  fun setDocument(documentJson: String, docHash: String) {
    server?.setMirror(Mirror(documentJson, docHash, nowIso()))
  }

  fun pendingIncoming(): List<Map<String, Any?>> =
    inbox?.list()?.map { it.toMap() } ?: emptyList()

  fun ackIncoming(id: String, result: Map<String, Any?>) {
    val stored = inbox?.find(id) ?: return
    val ok = result["ok"] as? Boolean ?: false
    inbox?.ack(id, ok)
    val next = inbox?.list()?.firstOrNull()
    if (ok) {
      server?.finishAck(
        ackedHash = stored.docHash,
        documentJson = stored.documentJson,
        docHash = result["docHash"] as? String ?: stored.docHash,
        updatedAt = result["updatedAt"] as? String ?: stored.updatedAt,
        next = next?.let { Mirror(it.documentJson, it.docHash, it.updatedAt) },
      )
    } else {
      server?.rejectAck(
        ackedHash = stored.docHash,
        next = next?.let { Mirror(it.documentJson, it.docHash, it.updatedAt) },
      )
    }
  }

  fun listPeers(): List<Map<String, Any?>> =
    peers?.stored()?.map { it.toPublicMap() } ?: emptyList()

  fun listNearby(): List<Map<String, Any?>> =
    discovery?.getNearby()?.map { it.toMap() } ?: emptyList()

  fun startPairing(): Map<String, Any?> =
    server?.startPairing() ?: throw IllegalStateException("Local sync is not running.")

  fun cancelPairing() {
    server?.cancelPairing()
  }

  fun pair(payload: Map<String, Any?>): Map<String, Any?> {
    val deviceId = payload["deviceId"] as? String ?: throw IllegalArgumentException("Invalid pairing code.")
    val fingerprint = payload["fingerprint"] as? String
      ?: throw IllegalArgumentException("Invalid pairing code.")
    val secret = payload["secret"] as? String
      ?: throw IllegalArgumentException("Invalid pairing code.")
    if (!isValidDeviceId(deviceId)) throw IllegalArgumentException("Invalid pairing code.")
    if (identity?.deviceId == deviceId) throw IllegalArgumentException("That is this device.")
    val nearby = findNearby(deviceId)
    val host = nearby?.host ?: payload["host"] as? String
    val port = nearby?.port ?: (payload["port"] as? Number)?.toInt()
    if (host.isNullOrEmpty() || port == null) {
      throw IllegalStateException("The other device is not reachable. Try discovery again.")
    }
    return requestPair(
      host = host,
      port = port,
      fingerprint = fingerprint,
      body = mapOf("secret" to secret),
      expectedDeviceId = deviceId,
    )
  }

  fun pairWithCode(deviceId: String, code: String): Map<String, Any?> {
    val nearby = findNearby(deviceId)
      ?: throw IllegalStateException("The other device is not nearby.")
    val normalized = normalizePairingCode(code)
    if (!Regex("^[A-Z0-9]{8}$").matches(normalized)) {
      throw IllegalArgumentException("Enter the 8-character code.")
    }
    return requestPair(
      host = nearby.host,
      port = nearby.port,
      fingerprint = nearby.fingerprint,
      body = mapOf("code" to normalized),
      expectedDeviceId = deviceId,
    )
  }

  fun forget(peerId: String) {
    val peer = peers?.find(peerId)
    if (peer != null) {
      val nearby = findNearby(peerId)
      val host = nearby?.host ?: peer.lastHost
      val port = nearby?.port ?: peer.lastPort
      if (host != null && port != null) {
        try {
          client.request(
            host = host,
            port = port,
            method = "POST",
            path = "/v1/unpair",
            body = "{}",
            token = peer.token,
            expectedFingerprint = peer.fingerprint,
          )
        } catch (_: Exception) {
          // Forgetting locally is what matters; the peer may be offline.
        }
      }
    }
    peers?.remove(peerId)
  }

  fun setAutoSync(peerId: String, autoSync: Boolean): Map<String, Any?> {
    val peer = peers?.setAutoSync(peerId, autoSync)
      ?: throw IllegalArgumentException("Unknown device.")
    return mapOf(
      "peerId" to peer.peerId,
      "name" to peer.name,
      "fingerprint" to peer.fingerprint,
      "autoSync" to peer.autoSync,
      "pairedAt" to peer.pairedAt,
      "lastSyncAt" to peer.lastSyncAt,
    )
  }

  fun request(peerId: String, request: Map<String, Any?>): Map<String, Any?> {
    val peer = peers?.find(peerId) ?: throw IllegalArgumentException("Unknown device.")
    val nearby = findNearby(peerId)
    val host = nearby?.host ?: peer.lastHost
    val port = nearby?.port ?: peer.lastPort
    if (host == null || port == null) throw IllegalStateException("The other device is not nearby.")
    val method = (request["method"] as? String ?: "GET").uppercase()
    val path = request["path"] as? String ?: throw IllegalArgumentException("Invalid path.")
    val body = request["body"]?.let { JSONObject(it as Map<*, *>).toString() }
    val response = client.request(
      host = host,
      port = port,
      method = method,
      path = path,
      body = body,
      token = peer.token,
      expectedFingerprint = peer.fingerprint,
    )
    val syncAt = if (method == "POST" && path == "/v1/document") nowIso() else null
    peers?.touch(peerId, lastHost = host, lastPort = port, lastSyncAt = syncAt)
    return mapOf("status" to response.status, "body" to response.body)
  }

  fun persistence(): String = if (peers?.encrypted == true) "encrypted" else "plaintext"

  private fun requestPair(
    host: String,
    port: Int,
    fingerprint: String,
    body: Map<String, Any?>,
    expectedDeviceId: String,
  ): Map<String, Any?> {
    val current = identity ?: throw IllegalStateException("Local sync is not running.")
    val clientToken = newToken()
    val payload = HashMap<String, Any?>(body)
    payload["deviceId"] = current.deviceId
    payload["name"] = current.name
    payload["fingerprint"] = current.fingerprint
    payload["certPem"] = current.certPem
    payload["token"] = clientToken
    payload["port"] = server?.port() ?: 0
    val response = client.request(
      host = host,
      port = port,
      method = "POST",
      path = "/v1/pair",
      body = JSONObject(payload).toString(),
      token = null,
      expectedFingerprint = fingerprint,
    )
    if (response.status != 200) {
      val message = try {
        JSONObject(response.body).optString("message", "The other device refused pairing.")
      } catch (_: Exception) {
        "The other device refused pairing."
      }
      throw IllegalStateException(message)
    }
    val json = JSONObject(response.body)
    if (json.optString("deviceId") != expectedDeviceId ||
      json.optString("fingerprint") != fingerprint
    ) {
      throw IllegalStateException("The other device sent an invalid pairing response.")
    }
    val hostToken = json.optString("token", "")
    val certPem = json.optString("certPem", "")
    if (hostToken.length < 16 || certPem.isEmpty()) {
      throw IllegalStateException("The other device sent an invalid pairing response.")
    }
    val existing = peers?.find(expectedDeviceId)
    val next = StoredPeer(
      peerId = expectedDeviceId,
      name = sanitizeName(json.optString("name", ""), "Nearby device"),
      fingerprint = fingerprint,
      certPem = certPem,
      token = hostToken,
      autoSync = existing?.autoSync ?: true,
      pairedAt = existing?.pairedAt ?: nowIso(),
      lastSyncAt = existing?.lastSyncAt,
      lastHost = host,
      lastPort = port,
    )
    peers?.upsert(next)
    return next.toPublicMap()
  }

  private fun findNearby(deviceId: String): NearbyPeer? =
    discovery?.getNearby()?.firstOrNull { it.deviceId == deviceId }
}
