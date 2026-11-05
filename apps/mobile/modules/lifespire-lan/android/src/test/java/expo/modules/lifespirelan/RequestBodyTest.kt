package expo.modules.lifespirelan

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InputStream

/**
 * A stream that hands the body out in fixed-size pieces, the way a socket does:
 * the reader cannot assume one `read` returns the whole declared length.
 */
private class PiecewiseStream(private val payload: ByteArray, private val piece: Int) : InputStream() {
  var reads = 0
    private set
  private var position = 0

  override fun read(): Int = throw UnsupportedOperationException("read(byte[], int, int) is the only path used")

  override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
    if (position >= payload.size) return -1
    reads += 1
    val size = minOf(piece, length, payload.size - position)
    payload.copyInto(bytes, offset, position, position + size)
    position += size
    return size
  }
}

class RequestBodyTest {
  // A raw string keeps the backslashes literal, so this is the exact wire text:
  // a JSON object whose `documentJson` value is itself a JSON string.
  private val json = """{"documentJson":"{\"title\":\"Misión Acción 🎯\"}"}"""

  @Test
  fun `an omitted charset decodes UTF-8 instead of NanoHTTPD's ASCII default`() {
    assertEquals(json, decodeRequestBody("application/json", json.toByteArray(Charsets.UTF_8)))
  }

  @Test
  fun `a missing content type decodes UTF-8`() {
    assertEquals(json, decodeRequestBody(null, json.toByteArray(Charsets.UTF_8)))
  }

  @Test
  fun `a declared UTF-8 charset is accepted in any case`() {
    assertEquals(
      json,
      decodeRequestBody("application/json; charset=UTF-8", json.toByteArray(Charsets.UTF_8)),
    )
    assertEquals(
      json,
      decodeRequestBody("application/json;charset=utf-8", json.toByteArray(Charsets.UTF_8)),
    )
  }

  @Test
  fun `a quoted charset is accepted`() {
    assertEquals(
      json,
      decodeRequestBody("application/json; charset=\"utf-8\"", json.toByteArray(Charsets.UTF_8)),
    )
  }

  @Test
  fun `an unknown charset falls back to UTF-8`() {
    assertEquals(
      json,
      decodeRequestBody("application/json; charset=not-a-real-charset", json.toByteArray(Charsets.UTF_8)),
    )
  }

  @Test
  fun `a declared legacy charset is still honoured`() {
    val latin1 = "Misión Acción"
    assertEquals(
      latin1,
      decodeRequestBody(
        "application/json; charset=ISO-8859-1",
        latin1.toByteArray(Charsets.ISO_8859_1),
      ),
    )
  }

  @Test
  fun `a body delivered in short reads is decoded whole`() {
    val stream = PiecewiseStream(json.toByteArray(Charsets.UTF_8), piece = 5)
    val body = readRequestBody(stream, json.toByteArray(Charsets.UTF_8).size.toLong(), "application/json")
    assertEquals(json, body.text)
    assertEquals(json.toByteArray(Charsets.UTF_8).size, body.received)
    assertFalse(body.truncated)
    assertTrue("a short read must not finish the body in one call", stream.reads > 1)
  }

  @Test
  fun `a truncated body is reported instead of decoded as garbage`() {
    val payload = json.toByteArray(Charsets.UTF_8)
    val stream = PiecewiseStream(payload.copyOf(payload.size - 4), piece = 7)
    val body = readRequestBody(stream, payload.size.toLong(), "application/json")
    assertEquals(payload.size - 4, body.received)
    assertTrue(body.truncated)
  }

  @Test
  fun `an empty declaration reads nothing at all`() {
    val stream = PiecewiseStream(json.toByteArray(Charsets.UTF_8), piece = 8)
    val body = readRequestBody(stream, 0, "application/json")
    assertNull(body.text)
    assertEquals(0, stream.reads)
    assertFalse(body.truncated)
  }

  @Test
  fun `an oversized declaration is clamped to the request limit`() {
    val stream = PiecewiseStream(json.toByteArray(Charsets.UTF_8), piece = json.length)
    val body = readRequestBody(stream, MAX_REQUEST_BYTES + 1L, "application/json")
    assertEquals(MAX_REQUEST_BYTES, body.expected)
    assertTrue(body.truncated)
  }

  @Test
  fun `a declared legacy charset is honoured through the stream path`() {
    val latin1 = "Misión Acción"
    val payload = latin1.toByteArray(Charsets.ISO_8859_1)
    val body = readRequestBody(
      PiecewiseStream(payload, piece = 3),
      payload.size.toLong(),
      "application/json; charset=ISO-8859-1",
    )
    assertEquals(latin1, body.text)
    assertFalse(body.truncated)
  }

  @Test
  fun `chunked transfer encoding is detected regardless of case`() {
    assertTrue(isChunkedTransferEncoding("chunked"))
    assertTrue(isChunkedTransferEncoding("Chunked"))
    assertTrue(isChunkedTransferEncoding("gzip, chunked"))
    assertFalse(isChunkedTransferEncoding(null))
    assertFalse(isChunkedTransferEncoding("gzip"))
    assertFalse(isChunkedTransferEncoding(""))
  }

  @Test
  fun `the legacy parser is handed a header that names UTF-8`() {
    assertEquals("application/json; charset=utf-8", utf8ContentType("application/json"))
    assertEquals("application/json; charset=utf-8", utf8ContentType(null))
    assertEquals("application/json; charset=utf-8", utf8ContentType(""))
    assertEquals(
      "application/json; charset=UTF-8",
      utf8ContentType("application/json; charset=UTF-8"),
    )
    assertEquals(
      "application/json; charset=ISO-8859-1",
      utf8ContentType("application/json; charset=ISO-8859-1"),
    )
  }
}
