package expo.modules.lifespirelan

import android.content.Context
import android.net.wifi.WifiManager
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.MulticastSocket
import java.net.NetworkInterface
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class LanDiscovery(
  context: Context,
  private val identity: DeviceIdentity,
  private var discoverable: Boolean,
  private val onPeers: (List<NearbyPeer>) -> Unit,
  private val onError: (String) -> Unit,
) {
  private val appContext = context.applicationContext
  private val peers = ConcurrentHashMap<String, NearbyPeer>()
  private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
  private var socket: MulticastSocket? = null
  private var receiver: Thread? = null
  @Volatile private var running = false
  private var httpsPort = 0
  private var multicastLock: WifiManager.MulticastLock? = null

  fun start(port: Int) {
    if (running) return
    httpsPort = port
    running = true
    try {
      val next = MulticastSocket(null)
      next.reuseAddress = true
      next.bind(InetSocketAddress(DISCOVERY_PORT))
      next.timeToLive = 1
      next.broadcast = true
      try {
        next.joinGroup(InetAddress.getByName(MULTICAST_ADDRESS))
      } catch (_: Exception) {
        // Broadcast still works on networks that reject multicast.
      }
      socket = next
      acquireMulticastLock()
      receiver = Thread { receiveLoop(next) }.also {
        it.isDaemon = true
        it.start()
      }
      scheduler.scheduleAtFixedRate({ announce() }, 0, 10, TimeUnit.SECONDS)
      scheduler.scheduleAtFixedRate({ expire() }, 5, 5, TimeUnit.SECONDS)
    } catch (error: Exception) {
      onError("Discovery is unavailable: ${error.message ?: "unknown error"}")
      stop()
    }
  }

  fun stop() {
    running = false
    try {
      socket?.close()
    } catch (_: Exception) {
      // Already closed.
    }
    socket = null
    receiver?.interrupt()
    receiver = null
    scheduler.shutdownNow()
    try {
      multicastLock?.release()
    } catch (_: Exception) {
      // The lock may already have been released by the system.
    }
    multicastLock = null
    peers.clear()
    onPeers(emptyList())
  }

  fun setDiscoverable(value: Boolean) {
    discoverable = value
    if (value && running && !scheduler.isShutdown) {
      probe()
      scheduler.schedule({ announce() }, 100, TimeUnit.MILLISECONDS)
    }
  }

  fun getNearby(): List<NearbyPeer> = peers.values.sortedBy { it.name }

  private fun acquireMulticastLock() {
    try {
      val wifi = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val lock = wifi.createMulticastLock("lifespire-lan")
      lock.setReferenceCounted(false)
      lock.acquire()
      multicastLock = lock
    } catch (_: Exception) {
      // Multicast is optional; broadcast does not need the lock.
    }
  }

  private fun receiveLoop(current: MulticastSocket) {
    val buffer = ByteArray(4096)
    while (running && !current.isClosed) {
      try {
        val packet = DatagramPacket(buffer, buffer.size)
        current.receive(packet)
        handle(
          String(packet.data, 0, packet.length, Charsets.UTF_8),
          packet.address?.hostAddress ?: continue,
          packet.port,
        )
      } catch (error: Exception) {
        if (running) {
          // A transient read error must not kill the receiver.
          continue
        }
      }
    }
  }

  private fun handle(raw: String, host: String, sourcePort: Int) {
    val json = try {
      JSONObject(raw)
    } catch (_: Exception) {
      return
    }
    if (json.optInt("v", 0) != PROTOCOL_VERSION) return
    val deviceId = json.optString("deviceId", "")
    if (deviceId.isEmpty() || deviceId == identity.deviceId) return
    val name = sanitizeName(json.optString("name", ""), "Nearby device")
    val port = json.optInt("port", 0)
    val fingerprint = json.optString("fingerprint", "")
    if (port <= 0 || port >= 65536 || fingerprint.length < 16) return
    val hostAddress = host.substringBefore('%')
    val next = NearbyPeer(
      deviceId = deviceId,
      name = name,
      host = hostAddress,
      port = port,
      fingerprint = fingerprint,
      lastSeenAt = System.currentTimeMillis(),
    )
    val previous = peers.put(deviceId, next)
    if (previous == null ||
      previous.name != next.name ||
      previous.host != next.host ||
      previous.port != next.port ||
      previous.fingerprint != next.fingerprint
    ) {
      onPeers(getNearby())
    }
    if (json.optString("kind") == "probe" && discoverable) {
      sendPacket(announcePacket(), hostAddress, sourcePort)
    }
  }

  private fun announcePacket(): String = JSONObject().apply {
    put("v", PROTOCOL_VERSION)
    put("kind", "announce")
    put("deviceId", identity.deviceId)
    put("name", identity.name)
    put("port", httpsPort)
    put("fingerprint", identity.fingerprint)
    put("protocol", PROTOCOL_VERSION)
  }.toString()

  private fun probePacket(): String = JSONObject().apply {
    put("v", PROTOCOL_VERSION)
    put("kind", "probe")
    put("deviceId", identity.deviceId)
    put("name", identity.name)
    put("port", httpsPort)
    put("fingerprint", identity.fingerprint)
    put("protocol", PROTOCOL_VERSION)
  }.toString()

  private fun probe() {
    if (!running) return
    val payload = probePacket()
    for (target in broadcastTargets()) sendPacket(payload, target, DISCOVERY_PORT)
  }

  private fun announce() {
    if (!running || !discoverable || httpsPort == 0) return
    val payload = announcePacket()
    for (target in broadcastTargets()) sendPacket(payload, target, DISCOVERY_PORT)
    sendPacket(payload, MULTICAST_ADDRESS, DISCOVERY_PORT)
  }

  private fun sendPacket(payload: String, host: String, port: Int) {
    val current = socket ?: return
    try {
      val bytes = payload.toByteArray(Charsets.UTF_8)
      val packet = DatagramPacket(bytes, bytes.size, InetAddress.getByName(host), port)
      synchronized(current) {
        current.send(packet)
      }
    } catch (_: Exception) {
      // A single unreachable interface must not stop the others.
    }
  }

  private fun broadcastTargets(): List<String> {
    val targets = linkedSetOf("255.255.255.255", "127.0.0.1")
    try {
      for (networkInterface in NetworkInterface.getNetworkInterfaces()) {
        if (!networkInterface.isUp) continue
        for (address in networkInterface.interfaceAddresses) {
          val broadcast = address.broadcast
          if (broadcast is Inet4Address) targets.add(broadcast.hostAddress ?: continue)
          val local = address.address
          if (local is Inet4Address) targets.add(local.hostAddress ?: continue)
        }
      }
    } catch (_: Exception) {
      // Keep the global broadcast fallback.
    }
    return targets.toList()
  }

  private fun expire() {
    val cutoff = System.currentTimeMillis() - 30_000
    var changed = false
    for ((deviceId, peer) in peers) {
      if (peer.lastSeenAt < cutoff) {
        peers.remove(deviceId)
        changed = true
      }
    }
    if (changed) onPeers(getNearby())
  }
}
