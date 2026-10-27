package expo.modules.lifespirelan

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.Inet4Address
import java.net.NetworkInterface
import java.security.MessageDigest
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

const val PROTOCOL_VERSION = 1
const val DISCOVERY_PORT = 47823
const val PAIRING_TTL_MS = 5 * 60 * 1000L
const val DOCUMENT_LIMIT_BYTES = 512 * 1024
const val MAX_REQUEST_BYTES = 2 * 1024 * 1024
const val MULTICAST_ADDRESS = "239.255.42.99"

data class DeviceIdentity(
  val deviceId: String,
  val name: String,
  val fingerprint: String,
  val certPem: String,
)

data class NearbyPeer(
  val deviceId: String,
  val name: String,
  val host: String,
  val port: Int,
  val fingerprint: String,
  val lastSeenAt: Long,
)

data class PeerRecord(
  val peerId: String,
  val name: String,
  val fingerprint: String,
  val autoSync: Boolean,
  val pairedAt: String,
  val lastSyncAt: String?,
)

data class StoredPeer(
  val peerId: String,
  val name: String,
  val fingerprint: String,
  val certPem: String,
  val token: String,
  val autoSync: Boolean,
  val pairedAt: String,
  val lastSyncAt: String?,
  val lastHost: String?,
  val lastPort: Int?,
)

data class PairingPayload(
  val v: Int = PROTOCOL_VERSION,
  val kind: String = "lifespire-pair",
  val deviceId: String,
  val name: String,
  val fingerprint: String,
  val host: String?,
  val port: Int,
  val secret: String,
  val expiresAt: String,
)

data class Mirror(
  val documentJson: String,
  val docHash: String,
  val updatedAt: String,
)

data class IncomingDocument(
  val id: String,
  val fromPeerId: String,
  val documentJson: String,
  val docHash: String,
  val updatedAt: String,
  val receivedAt: String,
)

fun nowIso(): String {
  val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
  format.timeZone = TimeZone.getTimeZone("UTC")
  return format.format(Date())
}

fun newToken(): String {
  val bytes = ByteArray(32)
  SecureRandom().nextBytes(bytes)
  return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
}

fun newDeviceId(): String = UUID.randomUUID().toString()

fun sha256Base64Url(bytes: ByteArray): String {
  val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
  return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
}

fun sanitizeName(value: String?, fallback: String = "LifeSpire device"): String {
  val clean = (value ?: "").replace(Regex("[^\\w .()-]"), "").trim()
  return (if (clean.isEmpty()) fallback else clean).take(120)
}

fun isPrivateAddress(raw: String?): Boolean {
  val address = (raw ?: return false).substringBefore('%')
  if (address == "::1" || address == "localhost") return true
  val ipv4 = if (address.startsWith("::ffff:")) address.substring(7) else address
  val parts = ipv4.split(".")
  if (parts.size == 4) {
    val first = parts[0].toIntOrNull() ?: return false
    val second = parts[1].toIntOrNull() ?: return false
    return first == 10 ||
      first == 127 ||
      (first == 192 && second == 168) ||
      (first == 169 && second == 254) ||
      (first == 172 && second in 16..31)
  }
  return address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80")
}

private const val CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

fun pairingCodeFromSecret(secret: String): String {
  var hash = 0x811c9dc5L
  for (character in secret) {
    hash = hash xor character.code.toLong()
    hash = (hash * 0x01000193L) and 0xffffffffL
  }
  val builder = StringBuilder()
  var value = hash
  repeat(8) {
    builder.append(CODE_ALPHABET[(value % CODE_ALPHABET.length).toInt()])
    value = value / CODE_ALPHABET.length + ((value % 97) + 17)
  }
  return builder.toString()
}

fun normalizePairingCode(raw: String): String =
  raw.uppercase().replace(Regex("[^A-Z0-9]"), "")

fun firstLanAddress(): String? {
  try {
    for (networkInterface in NetworkInterface.getNetworkInterfaces()) {
      if (!networkInterface.isUp || networkInterface.isLoopback) continue
      for (address in networkInterface.inetAddresses) {
        if (address is Inet4Address && !address.isLoopbackAddress && !address.isLinkLocalAddress) {
          val host = address.hostAddress ?: continue
          if (isPrivateAddress(host)) return host
        }
      }
    }
  } catch (_: Exception) {
    // No usable interface.
  }
  return null
}

fun DeviceIdentity.toMap(): Map<String, Any?> = mapOf(
  "deviceId" to deviceId,
  "name" to name,
  "fingerprint" to fingerprint,
)

fun NearbyPeer.toMap(): Map<String, Any?> = mapOf(
  "deviceId" to deviceId,
  "name" to name,
  "host" to host,
  "port" to port,
  "fingerprint" to fingerprint,
  "lastSeenAt" to nowIsoFromMillis(lastSeenAt),
)

fun StoredPeer.toPublicMap(): Map<String, Any?> = mapOf(
  "peerId" to peerId,
  "name" to name,
  "fingerprint" to fingerprint,
  "autoSync" to autoSync,
  "pairedAt" to pairedAt,
  "lastSyncAt" to lastSyncAt,
)

fun PairingPayload.toMap(): Map<String, Any?> = mapOf(
  "v" to v,
  "kind" to kind,
  "deviceId" to deviceId,
  "name" to name,
  "fingerprint" to fingerprint,
  "host" to host,
  "port" to port,
  "secret" to secret,
  "expiresAt" to expiresAt,
)

fun IncomingDocument.toMap(): Map<String, Any?> = mapOf(
  "id" to id,
  "fromPeerId" to fromPeerId,
  "documentJson" to documentJson,
  "docHash" to docHash,
  "updatedAt" to updatedAt,
)

fun StoredPeer.toJson(): JSONObject = JSONObject().apply {
  put("peerId", peerId)
  put("name", name)
  put("fingerprint", fingerprint)
  put("certPem", certPem)
  put("token", token)
  put("autoSync", autoSync)
  put("pairedAt", pairedAt)
  put("lastSyncAt", lastSyncAt ?: JSONObject.NULL)
  put("lastHost", lastHost ?: JSONObject.NULL)
  put("lastPort", lastPort ?: JSONObject.NULL)
}

fun storedPeerFromJson(json: JSONObject): StoredPeer? {
  val peerId = json.optString("peerId", "")
  val name = json.optString("name", "")
  val fingerprint = json.optString("fingerprint", "")
  val certPem = json.optString("certPem", "")
  val token = json.optString("token", "")
  if (peerId.isEmpty() || name.isEmpty() || fingerprint.isEmpty() || token.isEmpty()) return null
  return StoredPeer(
    peerId = peerId,
    name = name,
    fingerprint = fingerprint,
    certPem = certPem,
    token = token,
    autoSync = json.optBoolean("autoSync", true),
    pairedAt = json.optString("pairedAt", nowIso()),
    lastSyncAt = if (json.isNull("lastSyncAt")) null else json.optString("lastSyncAt"),
    lastHost = if (json.isNull("lastHost")) null else json.optString("lastHost"),
    lastPort = if (json.isNull("lastPort")) null else json.optInt("lastPort"),
  )
}

fun peersToJson(peers: List<StoredPeer>): String {
  val array = JSONArray()
  peers.forEach { array.put(it.toJson()) }
  return JSONObject().put("version", 1).put("peers", array).toString()
}

fun peersFromJson(raw: String?): MutableList<StoredPeer> {
  val result = mutableListOf<StoredPeer>()
  if (raw.isNullOrEmpty()) return result
  try {
    val root = JSONObject(raw)
    if (root.optInt("version", 0) != 1) return result
    val array = root.optJSONArray("peers") ?: return result
    for (index in 0 until array.length()) {
      val peer = array.optJSONObject(index) ?: continue
      storedPeerFromJson(peer)?.let(result::add)
    }
  } catch (_: Exception) {
    // A corrupt registry re-pairs rather than crashing.
  }
  return result
}

fun nowIsoFromMillis(millis: Long): String {
  val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
  format.timeZone = TimeZone.getTimeZone("UTC")
  return format.format(Date(millis))
}

fun isValidDeviceId(value: String): Boolean =
  Regex("^[A-Za-z0-9_-]{8,128}$").matches(value)
