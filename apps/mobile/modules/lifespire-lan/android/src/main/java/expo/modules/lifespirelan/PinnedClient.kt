package expo.modules.lifespirelan

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

data class PinnedResponse(val status: Int, val body: String)

private class FingerprintTrustManager(
  private val expectedFingerprint: String,
) : X509TrustManager {
  override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    // The client never authenticates with a certificate.
  }

  override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
    val certificate = chain?.firstOrNull() ?: throw CertificateException("No certificate")
    val fingerprint = sha256Base64Url(certificate.encoded)
    if (fingerprint != expectedFingerprint) {
      throw CertificateException("The other device presented a different certificate")
    }
  }

  override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
}

class PinnedClient {
  fun request(
    host: String,
    port: Int,
    method: String,
    path: String,
    body: String? = null,
    token: String? = null,
    expectedFingerprint: String,
  ): PinnedResponse {
    val trustManager = FingerprintTrustManager(expectedFingerprint)
    val sslContext = SSLContext.getInstance("TLS")
    sslContext.init(null, arrayOf<TrustManager>(trustManager), SecureRandom())
    val client = OkHttpClient.Builder()
      .sslSocketFactory(sslContext.socketFactory, trustManager)
      .hostnameVerifier { _, _ -> true }
      .connectTimeout(12, TimeUnit.SECONDS)
      .readTimeout(12, TimeUnit.SECONDS)
      .writeTimeout(12, TimeUnit.SECONDS)
      .build()
    val builder = Request.Builder()
      .url("https://${hostForUrl(host)}:$port$path")
      .header("Accept", "application/json")
    if (!token.isNullOrEmpty()) builder.header("Authorization", "Bearer $token")
    if (method == "POST") {
      builder.post((body ?: "{}").toRequestBody("application/json; charset=utf-8".toMediaType()))
    } else {
      builder.get()
    }
    client.newCall(builder.build()).execute().use { response ->
      return PinnedResponse(response.code, response.body?.string() ?: "")
    }
  }

  private fun hostForUrl(host: String): String =
    if (host.contains(":")) "[$host]" else host
}
