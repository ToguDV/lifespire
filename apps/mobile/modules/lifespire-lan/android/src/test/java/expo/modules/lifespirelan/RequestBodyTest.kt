package expo.modules.lifespirelan

import org.junit.Assert.assertEquals
import org.junit.Test

class RequestBodyTest {
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
}
