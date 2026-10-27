package expo.modules.lifespirelan

import android.content.Context
import android.util.Base64
import okhttp3.tls.HeldCertificate
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.KeyStore
import java.security.cert.Certificate
import java.security.cert.X509Certificate
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext

class Identity(
  val deviceId: String,
  val name: String,
  val fingerprint: String,
  val certPem: String,
  val keyStore: KeyStore,
  val password: String,
  val sslContext: SSLContext,
) {
  fun toDeviceIdentity(): DeviceIdentity = DeviceIdentity(
    deviceId = deviceId,
    name = name,
    fingerprint = fingerprint,
    certPem = certPem,
  )
}

class IdentityStore(context: Context) {
  private val appContext = context.applicationContext
  private val prefs = SecretPrefs(appContext)
  private val file = File(appContext.filesDir, "lifespire-lan-identity.p12")

  fun loadOrCreate(name: String): Identity {
    val existing = load(name)
    if (existing != null) return existing
    return generate(name)
  }

  fun load(name: String? = null): Identity? {
    val password = prefs.prefs.getString("identity-password", null)
    if (password == null) {
      if (file.exists()) {
        throw IllegalStateException(
          "The device identity could not be decrypted. Restore the Android keystore or reinstall and re-pair.",
        )
      }
      return null
    }
    if (!file.exists()) return null
    return try {
      val keyStore = KeyStore.getInstance("PKCS12")
      FileInputStream(file).use { keyStore.load(it, password.toCharArray()) }
      val certificate = keyStore.getCertificate("identity") as? X509Certificate ?: return null
      keyStore.getKey("identity", password.toCharArray()) ?: return null
      val deviceId = prefs.prefs.getString("device-id", null)
        ?: certificate.subjectX500Principal.name
          .substringAfter("CN=", "")
          .substringBefore(",")
          .takeIf { it.isNotBlank() }
        ?: return null
      val storedName = name
        ?: prefs.prefs.getString("device-name", null)
        ?: "LifeSpire device"
      if (prefs.prefs.getString("device-name", null) != storedName) {
        prefs.prefs.edit().putString("device-name", storedName).apply()
      }
      buildIdentity(deviceId, sanitizeName(storedName), certificate, keyStore, password)
    } catch (error: Exception) {
      if (file.exists()) {
        throw IllegalStateException(
          "The device identity could not be decrypted. Restore the Android keystore or reinstall and re-pair.",
          error,
        )
      }
      null
    }
  }

  fun rename(name: String): Identity {
    val clean = sanitizeName(name)
    val identity = load(clean) ?: return generate(clean)
    prefs.prefs.edit().putString("device-name", clean).apply()
    return identity
  }

  fun persistence(): String = if (prefs.encrypted) "encrypted" else "plaintext"

  private fun generate(name: String): Identity {
    val deviceId = newDeviceId()
    val certificate = HeldCertificate.Builder()
      .commonName(deviceId)
      .addSubjectAlternativeName("localhost")
      .build()
    val password = newToken()
    val keyStore = KeyStore.getInstance("PKCS12")
    keyStore.load(null, null)
    keyStore.setKeyEntry(
      "identity",
      certificate.keyPair.private,
      password.toCharArray(),
      arrayOf<Certificate>(certificate.certificate),
    )
    FileOutputStream(file).use { output ->
      keyStore.store(output, password.toCharArray())
    }
    // Keep the file readable only by this app; the directory is already private.
    file.setReadable(false, false)
    file.setReadable(true, true)
    file.setWritable(false, false)
    file.setWritable(true, true)
    prefs.prefs.edit()
      .putString("identity-password", password)
      .putString("device-id", deviceId)
      .putString("device-name", sanitizeName(name))
      .apply()
    return buildIdentity(
      deviceId,
      sanitizeName(name),
      certificate.certificate,
      keyStore,
      password,
    )
  }

  private fun buildIdentity(
    deviceId: String,
    name: String,
    certificate: X509Certificate,
    keyStore: KeyStore,
    password: String,
  ): Identity {
    val keyManagerFactory = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
    keyManagerFactory.init(keyStore, password.toCharArray())
    val sslContext = SSLContext.getInstance("TLS")
    sslContext.init(keyManagerFactory.keyManagers, null, null)
    val certPem = "-----BEGIN CERTIFICATE-----\n" +
      Base64.encodeToString(certificate.encoded, Base64.NO_WRAP) +
      "\n-----END CERTIFICATE-----\n"
    return Identity(
      deviceId = deviceId,
      name = name,
      fingerprint = sha256Base64Url(certificate.encoded),
      certPem = certPem,
      keyStore = keyStore,
      password = password,
      sslContext = sslContext,
    )
  }
}
