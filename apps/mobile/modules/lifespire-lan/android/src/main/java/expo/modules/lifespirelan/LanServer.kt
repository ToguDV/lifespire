package expo.modules.lifespirelan

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

class LanServer(
  context: Context,
  private val identity: Identity,
  private val peers: PeerStore,
  private val inbox: LanInbox,
  private val onIncoming: (IncomingDocument) -> Unit,
  private val onPaired: (PeerRecord) -> Unit,
  private val onError: (String) -> Unit,
) : NanoHTTPD(0) {
  private data class PairingState(val secret: String, val code: String, val expiresAt: Long)
  private data class PairAttempt(var count: Int, val resetAt: Long)

  private sealed class BeginResult {
    data class Accepted(val updatedAt: String) : BeginResult()
    data class Conflict(val current: Mirror?) : BeginResult()
    data class Noop(val current: Mirror) : BeginResult()
    object NotReady : BeginResult()
  }

  private val pairingAttempts = ConcurrentHashMap<String, PairAttempt>()
  private val stateLock = Any()
  @Volatile private var pairing: PairingState? = null
  @Volatile private var pairingFailures = 0
  @Volatile private var mirror: Mirror? = null
  @Volatile private var pendingMirror: Mirror? = null
  @Volatile private var ready = false

  init {
    makeSecure(identity.sslContext.serverSocketFactory, null)
  }

  fun startServer(): Int {
    start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
    return getListeningPort()
  }

  fun stopServer() {
    pairing = null
    stop()
  }

  fun port(): Int = getListeningPort()

  fun setMirror(next: Mirror?) = synchronized(stateLock) {
    mirror = next
    ready = next != null
  }

  fun setPendingMirror(next: Mirror?) = synchronized(stateLock) {
    pendingMirror = next
    if (next != null) ready = true
  }

  /**
   * Applies the acked inbox item and advances the pending reservation only if
   * it still belongs to that item. A concurrent push may already have reserved
   * the next hash; it must not be cleared by a late ack.
   */
  fun finishAck(
    ackedHash: String,
    documentJson: String,
    docHash: String,
    updatedAt: String,
    next: Mirror?,
  ) = synchronized(stateLock) {
    mirror = Mirror(documentJson, docHash, updatedAt)
    when {
      pendingMirror?.docHash == ackedHash -> pendingMirror = next
      pendingMirror == null && next != null -> pendingMirror = next
    }
    ready = true
  }

  fun rejectAck(ackedHash: String, next: Mirror?) = synchronized(stateLock) {
    when {
      pendingMirror?.docHash == ackedHash -> pendingMirror = next
      pendingMirror == null && next != null -> pendingMirror = next
    }
  }

  private fun currentMirror(): Mirror? = synchronized(stateLock) {
    pendingMirror ?: mirror
  }

  private fun beginPending(
    documentJson: String,
    expectedHash: String?,
    docHash: String,
    updatedAt: String,
  ): BeginResult = synchronized(stateLock) {
    val current = pendingMirror ?: mirror
    when {
      !ready -> BeginResult.NotReady
      current != null && expectedHash != current.docHash -> BeginResult.Conflict(current)
      current == null && expectedHash != null -> BeginResult.Conflict(null)
      current != null && docHash == current.docHash -> BeginResult.Noop(current)
      else -> {
        pendingMirror = Mirror(documentJson, docHash, updatedAt)
        BeginResult.Accepted(updatedAt)
      }
    }
  }

  private fun cancelPending(docHash: String) = synchronized(stateLock) {
    if (pendingMirror?.docHash == docHash) pendingMirror = null
  }

  @Synchronized
  fun startPairing(): Map<String, Any?> {
    val secret = newToken()
    val state = PairingState(
      secret = secret,
      code = pairingCodeFromSecret(secret),
      expiresAt = System.currentTimeMillis() + PAIRING_TTL_MS,
    )
    pairing = state
    pairingFailures = 0
    return PairingPayload(
      deviceId = identity.deviceId,
      name = identity.name,
      fingerprint = identity.fingerprint,
      host = firstLanAddress(),
      port = getListeningPort(),
      secret = secret,
      expiresAt = nowIsoFromMillis(state.expiresAt),
    ).toMap()
  }

  @Synchronized
  fun cancelPairing() {
    pairing = null
  }

  @Synchronized
  fun pairingPayload(): Map<String, Any?>? {
    val state = pairing ?: return null
    if (state.expiresAt <= System.currentTimeMillis()) {
      pairing = null
      return null
    }
    return PairingPayload(
      deviceId = identity.deviceId,
      name = identity.name,
      fingerprint = identity.fingerprint,
      host = firstLanAddress(),
      port = getListeningPort(),
      secret = state.secret,
      expiresAt = nowIsoFromMillis(state.expiresAt),
    ).toMap()
  }

  override fun serve(session: IHTTPSession): Response {
    val remote = session.remoteIpAddress ?: ""
    if (!isPrivateAddress(remote)) {
      return json(Response.Status.FORBIDDEN, JSONObject().put("message", "Local peers only."))
    }
    val path = session.uri.substringBefore('?')
    val method = session.method.name
    if (method == "GET" && path == "/health") {
      return json(
        Response.Status.OK,
        JSONObject()
          .put("ok", true)
          .put("deviceId", identity.deviceId)
          .put("protocol", PROTOCOL_VERSION),
      )
    }
    if (method == "POST" && path == "/v1/pair") {
      return handlePair(session, remote)
    }

    val peer = authenticate(session)
      ?: return json(Response.Status.UNAUTHORIZED, JSONObject().put("message", "Pairing token required."))

    return when {
      method == "GET" && path == "/v1/info" -> json(
        Response.Status.OK,
        JSONObject()
          .put("deviceId", identity.deviceId)
          .put("name", identity.name)
          .put("protocol", PROTOCOL_VERSION)
          .put("schemaVersion", 3)
          .put("docHash", currentMirror()?.docHash ?: JSONObject.NULL)
          .put("updatedAt", currentMirror()?.updatedAt ?: JSONObject.NULL),
      )
      method == "GET" && path == "/v1/document" -> {
        val current = currentMirror()
        if (current == null) {
          json(Response.Status.NOT_FOUND, JSONObject().put("message", "No save yet."))
        } else {
          json(
            Response.Status.OK,
            JSONObject()
              .put("documentJson", current.documentJson)
              .put("docHash", current.docHash)
              .put("updatedAt", current.updatedAt)
              .put("schemaVersion", 3),
          )
        }
      }
      method == "POST" && path == "/v1/document" -> handleDocument(session, peer, remote)
      method == "POST" && path == "/v1/unpair" -> {
        peers.remove(peer.peerId)
        empty(status(204))
      }
      else -> json(Response.Status.NOT_FOUND, JSONObject().put("message", "Not found."))
    }
  }

  @Synchronized
  private fun handlePair(session: IHTTPSession, remote: String): Response {
    val clock = System.currentTimeMillis()
    pairingAttempts.forEach { (address, value) ->
      if (value.resetAt <= clock) pairingAttempts.remove(address)
    }
    val attempt = pairingAttempts.compute(remote) { _, current ->
      val now = System.currentTimeMillis()
      if (current == null || current.resetAt <= now) PairAttempt(1, now + 60_000)
      else {
        current.count += 1
        current
      }
    }
    if ((attempt?.count ?: 0) > 5) {
      return json(
        status(429),
        JSONObject().put("message", "Too many pairing attempts. Try again later."),
      )
    }
    val state = pairing
      ?: return json(
        Response.Status.UNAUTHORIZED,
        JSONObject().put("message", "The pairing code is invalid or expired."),
      )
    if (state.expiresAt <= System.currentTimeMillis()) {
      pairing = null
      return json(
        Response.Status.UNAUTHORIZED,
        JSONObject().put("message", "The pairing code is invalid or expired."),
      )
    }
    val body = readJson(session)
      ?: return json(Response.Status.BAD_REQUEST, JSONObject().put("message", "Invalid pairing request."))
    val deviceId = body.optString("deviceId", "")
    val name = sanitizeName(body.optString("name", ""), "Nearby device")
    val fingerprint = body.optString("fingerprint", "")
    val certPem = body.optString("certPem", "")
    val clientToken = body.optString("token", "")
    val clientPort = body.optInt("port", 0)
    if (deviceId.isEmpty() || deviceId == identity.deviceId || fingerprint.length < 16 ||
      clientToken.length < 16 || certPem.isEmpty()
    ) {
      return json(Response.Status.BAD_REQUEST, JSONObject().put("message", "Invalid pairing request."))
    }
    val secretOk = body.optString("secret", "").let { candidate ->
      candidate.isNotEmpty() && MessageDigest.isEqual(
        candidate.toByteArray(),
        state.secret.toByteArray(),
      )
    }
    val codeOk = normalizePairingCode(body.optString("code", "")) == state.code
    if (!secretOk && !codeOk) {
      pairingFailures += 1
      if (pairingFailures >= 10) pairing = null
      return json(
        Response.Status.UNAUTHORIZED,
        JSONObject().put("message", "The pairing code is invalid or expired."),
      )
    }
    val existing = peers.find(deviceId)
    val hostToken = newToken()
    val next = StoredPeer(
      peerId = deviceId,
      name = name,
      fingerprint = fingerprint,
      certPem = certPem,
      token = hostToken,
      autoSync = existing?.autoSync ?: true,
      pairedAt = existing?.pairedAt ?: nowIso(),
      lastSyncAt = existing?.lastSyncAt,
      lastHost = remote.substringBefore('%'),
      lastPort = if (clientPort > 0 && clientPort < 65536) clientPort else existing?.lastPort,
    )
    peers.upsert(next)
    pairing = null
    pairingFailures = 0
    onPaired(
      PeerRecord(
        peerId = next.peerId,
        name = next.name,
        fingerprint = next.fingerprint,
        autoSync = next.autoSync,
        pairedAt = next.pairedAt,
        lastSyncAt = next.lastSyncAt,
      ),
    )
    return json(
      Response.Status.OK,
      JSONObject()
        .put("ok", true)
        .put("deviceId", identity.deviceId)
        .put("name", identity.name)
        .put("fingerprint", identity.fingerprint)
        .put("certPem", identity.certPem)
        .put("token", hostToken),
    )
  }

  private fun handleDocument(
    session: IHTTPSession,
    peer: StoredPeer,
    remote: String,
  ): Response {
    val body = readJson(session)
      ?: return json(
        Response.Status.BAD_REQUEST,
        JSONObject().put("message", "Invalid document payload."),
      )
    val documentJson = body.optString("documentJson", "")
    val docHash = body.optString("docHash", "")
    val expectedHash = if (body.isNull("expectedHash")) null else body.optString("expectedHash", "")
    if (documentJson.isEmpty() || docHash.isEmpty()) {
      return json(
        Response.Status.BAD_REQUEST,
        JSONObject().put("message", "Invalid document payload."),
      )
    }
    if (documentJson.toByteArray(Charsets.UTF_8).size > DOCUMENT_LIMIT_BYTES) {
      return json(status(413), JSONObject().put("message", "Document too large."))
    }
    try {
      JSONObject(documentJson)
    } catch (_: Exception) {
      return json(
        status(422),
        JSONObject().put("message", "The document is not valid JSON."),
      )
    }
    val updatedAt = nowIso()
    when (val result = beginPending(documentJson, expectedHash, docHash, updatedAt)) {
      is BeginResult.Noop -> return json(
        Response.Status.OK,
        JSONObject().put("docHash", result.current.docHash).put("updatedAt", result.current.updatedAt),
      )
      is BeginResult.Conflict -> {
        val current = result.current
        return json(
          Response.Status.CONFLICT,
          JSONObject()
            .put("docHash", current?.docHash ?: JSONObject.NULL)
            .put("updatedAt", current?.updatedAt ?: JSONObject.NULL),
        )
      }
      BeginResult.NotReady -> return json(
        status(503),
        JSONObject().put("message", "The other device is still preparing its save."),
      )
      is BeginResult.Accepted -> {
        val item = try {
          inbox.add(peer.peerId, documentJson, docHash, result.updatedAt)
        } catch (error: Exception) {
          cancelPending(docHash)
          onError("Could not store the incoming document: ${error.message ?: "disk error"}")
          return json(status(500), JSONObject().put("message", "Could not store the document."))
        }
        peers.touch(peer.peerId, lastHost = remote.substringBefore('%'), lastSyncAt = item.updatedAt)
        onIncoming(item)
        return json(
          Response.Status.ACCEPTED,
          JSONObject().put("docHash", item.docHash).put("updatedAt", item.updatedAt),
        )
      }
    }
  }

  private fun authenticate(session: IHTTPSession): StoredPeer? {
    val header = session.headers["authorization"] ?: return null
    val token = header.removePrefix("Bearer ").trim()
    return peers.findByToken(token)
  }

  private fun readJson(session: IHTTPSession): JSONObject? {
    val declared = session.headers["content-length"]?.toLongOrNull() ?: 0
    if (declared > MAX_REQUEST_BYTES) return null
    return try {
      val files = HashMap<String, String>()
      session.parseBody(files)
      val raw = files["postData"] ?: return null
      if (raw.toByteArray(Charsets.UTF_8).size > MAX_REQUEST_BYTES) return null
      JSONObject(raw)
    } catch (error: Exception) {
      onError("Invalid request body: ${error.message ?: "unreadable"}")
      null
    }
  }

  private fun status(code: Int): Response.Status =
    Response.Status.lookup(code) ?: Response.Status.BAD_REQUEST

  private fun json(responseStatus: Response.Status, body: JSONObject): Response {
    val response = NanoHTTPD.newFixedLengthResponse(responseStatus, "application/json; charset=utf-8", body.toString())
    response.addHeader("Cache-Control", "no-store")
    return response
  }

  private fun empty(responseStatus: Response.Status): Response {
    val response = NanoHTTPD.newFixedLengthResponse(responseStatus, "application/json", "")
    response.addHeader("Cache-Control", "no-store")
    return response
  }
}
