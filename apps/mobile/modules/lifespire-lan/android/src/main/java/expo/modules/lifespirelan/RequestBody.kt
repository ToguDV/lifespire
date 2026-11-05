package expo.modules.lifespirelan

import java.io.InputStream
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

/**
 * The `Content-Type` to hand NanoHTTPD's own parser: it must name a charset, or
 * `ContentType.getEncoding()` falls back to US-ASCII. A declared charset is kept
 * as is, so a peer that really speaks a legacy encoding still gets it.
 */
internal fun utf8ContentType(contentType: String?): String = when {
  contentType.isNullOrBlank() -> "application/json; charset=utf-8"
  CHARSET_PATTERN.containsMatchIn(contentType) -> contentType
  else -> "$contentType; charset=utf-8"
}

/** A chunked body carries no usable `Content-Length`; NanoHTTPD de-chunks it itself. */
internal fun isChunkedTransferEncoding(transferEncoding: String?): Boolean =
  transferEncoding?.contains("chunked", ignoreCase = true) == true

/**
 * A body read off the stream. [received] can be smaller than [expected] when the
 * peer closes the connection early; the caller must refuse a truncated body
 * instead of handing a half JSON document to the parser.
 */
internal data class WireBody(val text: String?, val expected: Int, val received: Int) {
  val truncated: Boolean get() = received < expected
}

/**
 * Reads exactly [declared] bytes from the session stream and decodes them with
 * the declared charset.
 *
 * NanoHTTPD's `parseBody` is deliberately not used here: it decodes with the
 * `Content-Type` charset, defaulting to US-ASCII when the parameter is absent
 * (`ContentType.getEncoding()`), and it writes bodies over 1 KB to a temp file.
 * The length is clamped to [MAX_REQUEST_BYTES] so a malformed header can never
 * allocate more than the request limit.
 */
internal fun readRequestBody(
  stream: InputStream,
  declared: Long,
  contentType: String?,
): WireBody {
  if (declared <= 0) return WireBody(null, 0, 0)
  val expected = minOf(declared, MAX_REQUEST_BYTES.toLong()).toInt()
  val bytes = ByteArray(expected)
  var offset = 0
  while (offset < bytes.size) {
    val read = stream.read(bytes, offset, bytes.size - offset)
    if (read <= 0) break
    offset += read
  }
  if (offset == 0) return WireBody(null, expected, 0)
  val body = if (offset == bytes.size) bytes else bytes.copyOf(offset)
  return WireBody(decodeRequestBody(contentType, body), expected, offset)
}
