package expo.modules.lifespirelan

import java.nio.charset.Charset

private val CHARSET_PATTERN = Regex("charset\\s*=\\s*\"?([^;\"\\s]+)", RegexOption.IGNORE_CASE)

/**
 * JSON is UTF-8 unless the sender declares another charset (RFC 8259 §8.1).
 *
 * NanoHTTPD 2.3.1 falls back to US-ASCII when `Content-Type` has no `charset`
 * parameter, so a peer that omitted it (the desktop shell before the fix) had
 * every accented character decoded as U+FFFD. Never rely on that default: an
 * absent or unknown charset means UTF-8.
 */
internal fun charsetForContentType(contentType: String?): Charset {
  val declared = contentType?.let { header ->
    CHARSET_PATTERN.find(header)?.groupValues?.get(1)
  }
  if (declared.isNullOrEmpty()) return Charsets.UTF_8
  return try {
    Charset.forName(declared)
  } catch (_: Exception) {
    Charsets.UTF_8
  }
}

internal fun decodeRequestBody(contentType: String?, bytes: ByteArray): String =
  String(bytes, charsetForContentType(contentType))
