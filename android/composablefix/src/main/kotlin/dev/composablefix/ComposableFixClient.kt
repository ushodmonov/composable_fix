package dev.composablefix

import android.content.Context
import android.os.Build
import android.os.Process
import android.util.Base64
import androidx.compose.ui.geometry.Offset
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/** What the long press captured, before the comment is typed. Points are in window pixels. */
internal class FixTarget(
    val element: FixElement?,
    val touch: Offset,
    /** Where the window's origin is on the screen, which the receiver's lookup works in. */
    val windowOrigin: Offset,
    val density: Float,
    val screen: String,
    /** A PNG, encoded while the comment is typed. */
    val screenshot: Deferred<ByteArray?>,
)

internal class FixStatus(
    /** Identifies the receiver's run, so ids from an earlier session are told apart. */
    val run: String,
    val id: String?,
    val status: String?,
)

/**
 * Talks to the receiver the composablefix mod runs on this Mac. The receiver keeps `adb reverse` set for
 * every device, so the app finds it on its own loopback; an emulator also reaches the Mac's
 * loopback at 10.0.2.2. HTTP goes over a plain socket: the platform's clients refuse cleartext
 * unless the app's network security config allows it, and the receiver is only ever local.
 */
internal object ComposableFixClient {
    private const val PORT = 4747
    private val hosts = listOf("127.0.0.1", "10.0.2.2")

    /** The host that answered last, tried first. */
    @Volatile
    private var reachable = hosts.first()

    /** Sends the report and returns the id the receiver gave it. */
    suspend fun send(context: Context, target: FixTarget, comment: String): String {
        val body = JSONObject()
            .put("comment", comment)
            .put("screen", target.screen)
            // The receiver reads the screen's accessibility tree, which is in screen pixels.
            .put("touch", point(target.touch + target.windowOrigin))
            .put("density", target.density.toDouble())
            .put("device", Build.MODEL)
            .put("android", androidApp(context))
        target.element?.let { element ->
            val frame = element.frame.translate(target.windowOrigin)
            body.put(
                "element",
                JSONObject()
                    .put("name", element.name)
                    .put("file", element.source?.file)
                    .put("line", element.source?.line)
                    .put(
                        "frame",
                        JSONObject()
                            .put("x", Math.round(frame.left)).put("y", Math.round(frame.top))
                            .put("width", Math.round(frame.width)).put("height", Math.round(frame.height)),
                    ),
            )
        }
        target.screenshot.await()?.let { body.put("screenshotPNG", Base64.encodeToString(it, Base64.NO_WRAP)) }

        // The receiver answers once it has read the screen's accessibility tree: a second or two.
        val answer = request("POST", "/report", body.toString().toByteArray(), timeoutMillis = 20_000)
        return JSONObject(answer).getString("id")
    }

    /** The status of one report. */
    suspend fun status(id: String): FixStatus = statusFrom(request("GET", "/status?id=$id"))

    /**
     * Says the app has launched, and returns the status of the report Claude is working on,
     * else of the newest one.
     */
    suspend fun launched(): FixStatus = statusFrom(request("POST", "/launched", ByteArray(0)))

    /** Lets the receiver find the device among those adb sees, and the prompt name the app. */
    private fun androidApp(context: Context): JSONObject {
        val launcher = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component
        return JSONObject()
            .put("package", context.packageName)
            .put("pid", Process.myPid())
            .put("component", launcher?.flattenToShortString())
    }

    private fun point(offset: Offset) = JSONObject().put("x", Math.round(offset.x)).put("y", Math.round(offset.y))

    private fun statusFrom(text: String): FixStatus {
        val json = JSONObject(text)
        return FixStatus(
            run = json.optString("run"),
            id = if (json.isNull("id")) null else json.optString("id"),
            status = if (json.isNull("status")) null else json.optString("status"),
        )
    }

    private suspend fun request(
        method: String,
        path: String,
        body: ByteArray? = null,
        timeoutMillis: Int = 3_000,
    ): String = withContext(Dispatchers.IO) {
        var failure: IOException? = null
        for (host in listOf(reachable) + (hosts - reachable)) {
            try {
                return@withContext exchange(host, method, path, body, timeoutMillis).also { reachable = host }
            } catch (error: IOException) {
                failure = error
            }
        }
        throw failure ?: IOException("no receiver")
    }

    /** One HTTP/1.1 request on its own connection; the receiver answers with a length and closes. */
    private fun exchange(host: String, method: String, path: String, body: ByteArray?, timeoutMillis: Int): String =
        Socket().use { socket ->
            socket.connect(InetSocketAddress(host, PORT), 1_000)
            socket.soTimeout = timeoutMillis

            val head = buildString {
                append("$method $path HTTP/1.1\r\n")
                append("Host: $host:$PORT\r\n")
                append("Connection: close\r\n")
                if (body != null) {
                    append("Content-Type: application/json\r\n")
                    append("Content-Length: ${body.size}\r\n")
                }
                append("\r\n")
            }
            val output = socket.getOutputStream()
            output.write(head.toByteArray())
            body?.let(output::write)
            output.flush()

            val response = socket.getInputStream().readBytes().toString(Charsets.UTF_8)
            val code = response.substringBefore("\r\n").split(' ').getOrNull(1)?.toIntOrNull()
            if (code != 200) throw IOException("$host answered ${code ?: "nothing"}")
            response.substringAfter("\r\n\r\n")
        }
}
