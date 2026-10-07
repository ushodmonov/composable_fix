package dev.composablefix

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.PixelCopy
import android.view.View
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONException
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Installs the long press, the report composer and the status banners around the app's content.
 * Wrap the root of the activity's content in it, once:
 *
 * ```
 * setContent { ComposableFixHost { App() } }
 * ```
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun ComposableFixHost(content: @Composable () -> Unit) {
    val session = FixSession.shared
    val context = LocalContext.current
    val view = LocalView.current
    val holder = remember { HostCoordinates() }
    val lift by animateFloatAsState(session.lift, tween(300), label = "composablefix.lift")

    LaunchedEffect(Unit) {
        session.context = context.applicationContext
        session.announceLaunch()
    }
    KeyboardWatcher(session)

    Box(
        Modifier
            .fillMaxSize()
            // Test tags show in the accessibility tree the receiver reads, as resource ids.
            .semantics { testTagsAsResourceId = true }
            .onGloballyPositioned { holder.coordinates = it }
            .pointerInput(session) {
                watchLongPresses(canStart = session::canBegin) { position ->
                    val coordinates = holder.coordinates ?: return@watchLongPresses
                    session.report(view, coordinates.localToWindow(position))
                }
            },
    ) {
        Box(Modifier.fillMaxSize().graphicsLayer { translationY = -lift }) {
            content()
        }

        FixComposerOverlay(session, lift, toLocal = { holder.coordinates?.windowToLocal(it) ?: it })
        FixBanner(session.banner)
    }
}

private class HostCoordinates {
    var coordinates: LayoutCoordinates? = null
}

/** Tells the session whether the keyboard is up; on its own so the app's content is not recomposed. */
@Composable
private fun KeyboardWatcher(session: FixSession) {
    val isShown = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    SideEffect { session.isKeyboardShown = isShown }
}

private const val PRESS_MILLIS = 500L

/**
 * A long press anywhere, seen before the app's own gestures (the initial pass) and left to them
 * until it has lasted half a second without moving. From then on the press is ComposableFix's: the rest
 * of it is consumed, so the button or list under the finger does not also act on it.
 */
private suspend fun PointerInputScope.watchLongPresses(canStart: () -> Boolean, onLongPress: (Offset) -> Unit) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
        if (!canStart()) return@awaitEachGesture

        val ended = withTimeoutOrNull(PRESS_MILLIS) {
            while (true) {
                val event = awaitPointerEvent(PointerEventPass.Initial)
                val change = event.changes.firstOrNull { it.id == down.id }
                if (change == null || !change.pressed || event.changes.count { it.pressed } > 1) break
                if ((change.position - down.position).getDistance() > viewConfiguration.touchSlop) break
            }
        }
        if (ended != null) return@awaitEachGesture

        onLongPress(down.position)
        do {
            val event = awaitPointerEvent(PointerEventPass.Initial)
            event.changes.forEach { it.consume() }
        } while (event.changes.any { it.pressed })
    }
}

internal class FixSession private constructor() {
    var target by mutableStateOf<FixTarget?>(null)
        private set
    var banner by mutableStateOf<Banner?>(null)
        private set

    /** How far the app is slid up so the keyboard does not cover the pressed element, in pixels. */
    var lift by mutableFloatStateOf(0f)

    /** The comment being typed in the composer. */
    var draft by mutableStateOf("")

    /**
     * A report is on its way: the receiver answers once it has read the screen, and until then a
     * new long press would change the screen it reads.
     */
    var isSending by mutableStateOf(false)
        private set

    var isKeyboardShown = false
    lateinit var context: Context

    /** A banner at the top of the screen; without an icon it shows a spinner, for work under way. */
    data class Banner(val text: String, val icon: FixIcon? = null)

    private val scope = MainScope()
    private var polling: Job? = null
    private var hiding: Job? = null
    private var isCapturing = false
    private var hasAnnounced = false

    fun canBegin() = target == null && !isSending && !isCapturing

    /**
     * Opens the composer for the element at the point, in window pixels, once the screen as it is
     * now has been captured.
     */
    fun report(view: View, at: Offset) {
        if (!canBegin()) return
        isCapturing = true

        val element = FixRegistry.shared.element(at)
        val density = view.resources.displayMetrics.density
        val origin = IntArray(2).also { view.rootView.getLocationOnScreen(it) }
        captureWindow(view) { bitmap ->
            isCapturing = false
            val screenshot = CompletableDeferred<ByteArray?>()
            if (bitmap == null) {
                screenshot.complete(null)
            } else {
                // Encoding takes a moment; the composer opens meanwhile.
                scope.launch(Dispatchers.Default) {
                    screenshot.complete(encode(bitmap, element?.frame, at, density))
                }
            }
            draft = ""
            target = FixTarget(
                element = element,
                touch = at,
                windowOrigin = Offset(origin[0].toFloat(), origin[1].toFloat()),
                density = density,
                screen = FixRegistry.shared.screen,
                screenshot = screenshot,
            )
        }
    }

    fun cancel() {
        target = null
        lift = 0f
    }

    fun send(comment: String) {
        val target = target ?: return
        if (comment.isEmpty()) return

        polling?.cancel()
        isSending = true
        polling = scope.launch {
            // The receiver reads the screen's accessibility tree as the report arrives, so the report
            // leaves once the composer and the keyboard are gone and the screen is back to what was pressed.
            dismiss()
            val id = attempt { ComposableFixClient.send(context, target, comment) }
            isSending = false
            if (id == null) {
                show(Banner("Claude Code is not listening", FixIcon.Offline), seconds = 4)
                return@launch
            }
            show(Banner("Sent to Claude Code"))
            follow(id)
        }
    }

    private suspend fun dismiss() {
        val hadKeyboard = isKeyboardShown
        cancel()
        // The composer fades out and the app slides back down.
        delay(350)
        // The keyboard slides away on its own clock, a little after the composer.
        val deadline = SystemClock.uptimeMillis() + 1_000
        while (hadKeyboard && isKeyboardShown && SystemClock.uptimeMillis() < deadline) {
            delay(50)
        }
    }

    /**
     * At launch: tells the receiver the app is up, which is how the mod learns that a fix is on
     * screen however the app was built. Then follows the report Claude is working on, or says so
     * once when the build on screen is the one that just went live. Once per process: an activity
     * recreated by a rotation or a fold is not a new build.
     */
    suspend fun announceLaunch() {
        if (hasAnnounced) return
        hasAnnounced = true

        val latest = attempt { ComposableFixClient.launched() } ?: return
        val id = latest.id ?: return
        when (latest.status) {
            null, "stopped" -> Unit
            "live" -> announceFixed(latest)
            else -> polling = scope.launch { follow(id) }
        }
    }

    private fun announceFixed(fix: FixStatus) {
        val key = "${fix.run}/${fix.id}"
        val preferences = context.getSharedPreferences("composablefix", Context.MODE_PRIVATE)
        if (preferences.getString("announced", null) == key) return
        preferences.edit().putString("announced", key).apply()
        show(Banner("Fixed by Claude Code", FixIcon.Fixed), seconds = 4)
    }

    private suspend fun follow(id: String) {
        while (true) {
            delay(1_000)
            val latest = attempt { ComposableFixClient.status(id) } ?: continue

            when (latest.status) {
                null -> continue
                "fixing" -> show(Banner("Claude is fixing it"))
                "rebuilding" -> show(Banner("Rebuilding the app"))
                "live" -> return announceFixed(latest)
                "stopped" -> return show(Banner("Not rebuilt: see Claude Code", FixIcon.Failed), seconds = 4)
                else -> show(Banner("Queued in Claude Code"))
            }
        }
    }

    private fun show(banner: Banner, seconds: Long? = null) {
        hiding?.cancel()
        this.banner = banner

        if (seconds == null) return
        hiding = scope.launch {
            delay(seconds * 1_000)
            this@FixSession.banner = null
        }
    }

    /** The answer, or null when the receiver is not there or answered something else. */
    private suspend fun <T> attempt(call: suspend () -> T): T? =
        try {
            call()
        } catch (_: IOException) {
            null
        } catch (_: JSONException) {
            null
        }

    companion object {
        val shared = FixSession()
    }
}

/** The window as it is on screen now, or null when it cannot be read. */
private fun captureWindow(view: View, done: (Bitmap?) -> Unit) {
    val root = view.rootView
    if (root.width == 0 || root.height == 0) return done(null)
    val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
    val window = view.context.findActivity()?.window

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && window != null) {
        // The window's surface as composed, hardware layers and surface views included.
        PixelCopy.request(
            window, bitmap,
            { result -> done(bitmap.takeIf { result == PixelCopy.SUCCESS }) },
            Handler(Looper.getMainLooper()),
        )
    } else {
        root.draw(Canvas(bitmap))
        done(bitmap)
    }
}

/**
 * The screenshot as a PNG at one pixel per dp, with the reported element outlined in red, or a
 * red ring where the finger was when no marked element is under it.
 */
private fun encode(bitmap: Bitmap, frame: Rect?, touch: Offset, density: Float): ByteArray {
    val scale = 1f / density
    val scaled = Bitmap.createScaledBitmap(
        bitmap, max(1, (bitmap.width * scale).roundToInt()), max(1, (bitmap.height * scale).roundToInt()), true,
    )
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
        color = 0xFFFF3B30.toInt()
    }
    val canvas = Canvas(scaled)
    if (frame != null) {
        val outline = RectF(frame.left * scale - 4, frame.top * scale - 4, frame.right * scale + 4, frame.bottom * scale + 4)
        canvas.drawRoundRect(outline, 8f, 8f, paint)
    } else {
        canvas.drawOval(RectF(touch.x * scale - 22, touch.y * scale - 22, touch.x * scale + 22, touch.y * scale + 22), paint)
    }
    return ByteArrayOutputStream().also { scaled.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
