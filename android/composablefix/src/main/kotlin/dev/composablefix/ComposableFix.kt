package dev.composablefix

import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.node.GlobalPositionAwareModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.platform.InspectorInfo

// ComposableFix: long press anything in a debug build running on an emulator or a device, type what is
// wrong, and the report goes to the Claude Code session listening on this Mac through the composablefix
// mod. Release builds depend on composablefix-noop instead, which carries none of it.

/**
 * Optional: names an element and records the source line it was declared on, so its reports
 * point at that line. Unmarked elements are reported through accessibility.
 */
fun Modifier.fixable(name: String): Modifier = this then FixableElement(name, callSite())

/** Optional: names the screen on display, sent along with each report. */
fun Modifier.fixScreen(name: String): Modifier = this then FixScreenElement(name)

/** Where a `.fixable` call was made: its package path (`com/example/home/Card.kt`) and line. */
internal data class FixSource(val file: String, val line: Int)

/**
 * The code that called [fixable], from the stack: Kotlin has no `#filePath`. A frame names the
 * file and the class; the class's package gives the folders, which is how sources are laid out.
 */
private fun callSite(): FixSource? {
    val stack = Throwable().stackTrace
    val here = stack.indexOfFirst { it.methodName == "fixable" }
    val caller = stack.getOrNull(here + 1)?.takeIf { here >= 0 } ?: return null
    return sourceOf(caller.className, caller.fileName ?: return null, caller.lineNumber)
}

/** `com.example.home.CardKt$Card$1` in `Card.kt` at 12 is `com/example/home/Card.kt:12`. */
internal fun sourceOf(className: String, fileName: String, line: Int): FixSource {
    val folders = className.substringBefore('$').substringBeforeLast('.', "").replace('.', '/')
    return FixSource(if (folders.isEmpty()) fileName else "$folders/$fileName", line)
}

internal data class FixElement(
    val name: String,
    val source: FixSource?,
    /** In window pixels, clipped to what is on screen. */
    val frame: Rect,
)

/** The marked elements currently on screen, with their frames in window coordinates. */
internal class FixRegistry {
    var screen = ""

    // In attach order: a parent attaches before what it contains.
    private val elements = LinkedHashMap<Any, FixElement>()

    fun update(key: Any, element: FixElement) {
        elements[key] = element
    }

    fun remove(key: Any) {
        elements.remove(key)
    }

    fun element(named: String): FixElement? = elements.values.firstOrNull { it.name == named }

    /** The innermost element under the point: the smallest frame that holds it, the later of two alike. */
    fun element(at: Offset): FixElement? {
        var best: FixElement? = null
        for (element in elements.values) {
            if (element.frame.isEmpty || !element.frame.contains(at)) continue
            if (best == null || element.frame.area <= best.frame.area) best = element
        }
        return best
    }

    companion object {
        val shared = FixRegistry()
    }
}

private val Rect.area get() = width * height

private data class FixableElement(val name: String, val source: FixSource?) : ModifierNodeElement<FixableNode>() {
    override fun create() = FixableNode(name, source)

    override fun update(node: FixableNode) {
        node.name = name
        node.source = source
        node.publish()
    }

    override fun InspectorInfo.inspectableProperties() {
        this.name = "fixable"
        properties["name"] = this@FixableElement.name
    }
}

private class FixableNode(var name: String, var source: FixSource?) : Modifier.Node(), GlobalPositionAwareModifierNode {
    private var frame: Rect? = null

    override fun onGloballyPositioned(coordinates: LayoutCoordinates) {
        frame = coordinates.boundsInWindow()
        publish()
    }

    fun publish() {
        val frame = frame ?: return
        if (isAttached) FixRegistry.shared.update(this, FixElement(name, source, frame))
    }

    override fun onDetach() {
        frame = null
        FixRegistry.shared.remove(this)
    }
}

private data class FixScreenElement(val name: String) : ModifierNodeElement<FixScreenNode>() {
    override fun create() = FixScreenNode(name)

    override fun update(node: FixScreenNode) {
        node.name = name
        FixRegistry.shared.screen = name
    }

    override fun InspectorInfo.inspectableProperties() {
        this.name = "fixScreen"
        properties["name"] = this@FixScreenElement.name
    }
}

private class FixScreenNode(var name: String) : Modifier.Node() {
    override fun onAttach() {
        FixRegistry.shared.screen = name
    }
}

/** ComposableFix's own views carry test tags under `composablefix.`; the receiver's lookup skips them. */
internal fun fixTag(name: String) = "composablefix.$name"
