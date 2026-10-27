package expo.modules.lifespirelan

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Tokens, the device certificate password and the peer registry live behind
 * the Android keystore when it is available. Falling back to app-private
 * preferences keeps sync usable on devices without a working keystore; the UI
 * reports that state instead of pretending the file is encrypted.
 */
class SecretPrefs(context: Context) {
  val encrypted: Boolean
  val prefs: SharedPreferences

  init {
    var secure: SharedPreferences? = null
    try {
      val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
      secure = EncryptedSharedPreferences.create(
        context,
        "lifespire-lan-secrets",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
      )
    } catch (_: Exception) {
      secure = null
    }
    if (secure == null) {
      prefs = context.getSharedPreferences("lifespire-lan-fallback", Context.MODE_PRIVATE)
      encrypted = false
    } else {
      prefs = secure
      encrypted = true
    }
  }
}
