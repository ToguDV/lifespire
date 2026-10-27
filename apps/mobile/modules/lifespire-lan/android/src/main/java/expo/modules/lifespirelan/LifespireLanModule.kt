package expo.modules.lifespirelan

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LifespireLanModule : Module() {
  private val manager: LanManager by lazy {
    val context: Context = appContext.reactContext
      ?: throw IllegalStateException("LifeSpire LAN needs an Android context")
    LanManager(
      context = context,
      emitPeers = { peers -> sendEvent("onPeersChanged", mapOf("peers" to peers.map { it.toMap() })) },
      emitPaired = { peer -> sendEvent("onPaired", mapOf("peer" to peer.toPublicMap())) },
      emitIncoming = { item -> sendEvent("onIncomingDocument", mapOf("item" to item.toMap())) },
      emitError = { message -> sendEvent("onError", mapOf("message" to message)) },
    )
  }

  override fun definition() = ModuleDefinition {
    Name("LifespireLan")

    Events("onPeersChanged", "onPaired", "onIncomingDocument", "onError")

    AsyncFunction("start") { options: Map<String, Any?> ->
      manager.start(options)
    }

    AsyncFunction("stop") {
      manager.stop()
    }

    AsyncFunction("setDiscoverable") { discoverable: Boolean ->
      manager.setDiscoverable(discoverable)
    }

    AsyncFunction("setDocument") { documentJson: String, docHash: String ->
      manager.setDocument(documentJson, docHash)
    }

    AsyncFunction("pendingIncoming") {
      manager.pendingIncoming()
    }

    AsyncFunction("ackIncoming") { id: String, result: Map<String, Any?> ->
      manager.ackIncoming(id, result)
    }

    AsyncFunction("listPeers") {
      manager.listPeers()
    }

    AsyncFunction("listNearby") {
      manager.listNearby()
    }

    AsyncFunction("startPairing") {
      manager.startPairing()
    }

    AsyncFunction("cancelPairing") {
      manager.cancelPairing()
    }

    AsyncFunction("pair") { payload: Map<String, Any?> ->
      manager.pair(payload)
    }

    AsyncFunction("pairWithCode") { deviceId: String, code: String ->
      manager.pairWithCode(deviceId, code)
    }

    AsyncFunction("forget") { peerId: String ->
      manager.forget(peerId)
    }

    AsyncFunction("setAutoSync") { peerId: String, autoSync: Boolean ->
      manager.setAutoSync(peerId, autoSync)
    }

    AsyncFunction("request") { peerId: String, request: Map<String, Any?> ->
      manager.request(peerId, request)
    }

    AsyncFunction("persistence") {
      manager.persistence()
    }

    OnDestroy {
      // The module may be destroyed before it was ever used (no context).
      runCatching { manager.stop() }
    }
  }
}
