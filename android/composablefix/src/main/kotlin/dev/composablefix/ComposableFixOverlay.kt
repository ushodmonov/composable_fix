package dev.composablefix

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max
import kotlin.math.roundToInt

private val fixTint = Color(0xFFD97857)

/**
 * The dimmed screen with the pressed element lit, and the comment field above the keyboard.
 * Points arrive in window pixels; [toLocal] turns them into the host's.
 */
@Composable
internal fun BoxScope.FixComposerOverlay(session: FixSession, lift: Float, toLocal: (Offset) -> Offset) {
    // Kept through the fade-out, after the session has let go of it.
    val last = remember { object { var target: FixTarget? = null } }
    session.target?.let { last.target = it }

    AnimatedVisibility(
        visible = session.target != null,
        modifier = Modifier.matchParentSize(),
        enter = fadeIn(tween(250)),
        exit = fadeOut(tween(200)),
    ) {
        val target = last.target ?: return@AnimatedVisibility
        FixComposer(target, session, lift, toLocal)
    }
}

@Composable
private fun FixComposer(target: FixTarget, session: FixSession, lift: Float, toLocal: (Offset) -> Offset) {
    val density = LocalDensity.current
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = remember { FocusRequester() }
    val pulse by rememberInfiniteTransition(label = "composablefix.pulse").animateFloat(
        initialValue = 0.35f,
        targetValue = 0.95f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "composablefix.pulse",
    )

    val marked = target.element != null
    val spot = (target.element?.frame ?: Rect(target.touch, target.touch))
        .let { Rect(toLocal(it.topLeft), it.size) }
        .translate(0f, -lift)
        .inflate(with(density) { (if (marked) 6.dp else 28.dp).toPx() })
    val corner = with(density) { (if (marked) 12.dp else 28.dp).toPx() }

    BackHandler { session.cancel() }
    LaunchedEffect(Unit) {
        focus.requestFocus()
        keyboard?.show()
    }
    DisposableEffect(Unit) {
        onDispose { keyboard?.hide() }
    }

    Box(Modifier.fillMaxSize().testTag(fixTag("composer"))) {
        Canvas(
            Modifier
                .fillMaxSize()
                .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
                .pointerInput(session) { detectTapGestures { session.cancel() } },
        ) {
            drawRect(Color.Black.copy(alpha = 0.62f))
            drawRoundRect(Color.Black, spot.topLeft, spot.size, CornerRadius(corner), blendMode = BlendMode.Clear)
            // The glow, wider and fainter outwards, then the edge itself.
            for (ring in 3 downTo 1) {
                drawRoundRect(
                    fixTint.copy(alpha = pulse * 0.3f / ring), spot.topLeft, spot.size, CornerRadius(corner),
                    style = Stroke(width = (2 + ring * 5).dp.toPx()),
                )
            }
            drawRoundRect(fixTint, spot.topLeft, spot.size, CornerRadius(corner), style = Stroke(width = 2.dp.toPx()))
        }

        title(target)?.let { SpotLabel(it, spot) }

        Composer(
            session = session,
            focus = focus,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars))
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .onGloballyPositioned { coordinates ->
                    // Slides the app up when the keyboard would cover the pressed element; not
                    // while the composer fades out, when the app is sliding back down.
                    if (session.target == null) return@onGloballyPositioned
                    val bottom = (target.element?.frame?.bottom ?: target.touch.y) + with(density) { 28.dp.toPx() }
                    session.lift = max(0f, bottom - coordinates.boundsInWindow().top)
                },
        )
    }
}

/** The marked element and its source line, else the screen's name when the app gives one. */
private fun title(target: FixTarget): String? {
    target.element?.let { element ->
        val source = element.source ?: return element.name
        return "${element.name}  ·  ${source.file.substringAfterLast('/')}:${source.line}"
    }
    return target.screen.takeIf { it.isNotEmpty() }?.let { "$it screen" }
}

/** A pill above the spot when there is room, else below it, kept 12dp inside the screen's edges. */
@Composable
private fun SpotLabel(title: String, spot: Rect) {
    Layout(
        content = {
            BasicText(
                text = title,
                style = TextStyle(color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace),
                maxLines = 1,
                modifier = Modifier.background(fixTint, CircleShape).padding(horizontal = 10.dp, vertical = 6.dp),
            )
        },
        modifier = Modifier.fillMaxSize(),
    ) { measurables, constraints ->
        val label = measurables.single().measure(Constraints(maxWidth = constraints.maxWidth))
        layout(constraints.maxWidth, constraints.maxHeight) {
            val margin = 12.dp.toPx()
            val gap = 10.dp.toPx()
            val x = (spot.center.x - label.width / 2f).coerceIn(margin, max(margin, constraints.maxWidth - label.width - margin))
            val y = if (spot.top > 120.dp.toPx()) spot.top - gap - label.height else spot.bottom + gap
            label.place(x.roundToInt(), y.roundToInt())
        }
    }
}

@Composable
private fun Composer(session: FixSession, focus: FocusRequester, modifier: Modifier) {
    val submit = { session.send(session.draft.trim()) }
    val shape = CircleShape

    Row(
        modifier = modifier
            .fillMaxWidth()
            .shadow(18.dp, shape)
            .background(Color(0xF0202024), shape)
            .border(1.dp, fixTint.copy(alpha = 0.55f), shape)
            .padding(start = 16.dp, end = 7.dp, top = 7.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        FixIconImage(FixIcon.Sparkle, fixTint, Modifier.size(18.dp))

        BasicTextField(
            value = session.draft,
            onValueChange = { session.draft = it },
            modifier = Modifier
                .weight(1f)
                .focusRequester(focus)
                // A hardware keyboard's Return sends, as the keyboard's own send key does.
                .onPreviewKeyEvent { event ->
                    val isReturn = event.key == Key.Enter || event.key == Key.NumPadEnter
                    if (isReturn && event.type == KeyEventType.KeyDown) submit()
                    isReturn
                },
            textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
            cursorBrush = SolidColor(fixTint),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onSend = { submit() }),
            decorationBox = { field ->
                Box {
                    if (session.draft.isEmpty()) {
                        BasicText(
                            "What should Claude fix here?",
                            style = TextStyle(color = Color.White.copy(alpha = 0.45f), fontSize = 16.sp),
                        )
                    }
                    field()
                }
            },
        )

        Box(
            Modifier
                .size(38.dp)
                .clip(shape)
                .background(if (session.draft.isEmpty()) Color.White.copy(alpha = 0.14f) else fixTint)
                .clickable(enabled = session.draft.isNotEmpty(), onClick = submit),
            contentAlignment = Alignment.Center,
        ) {
            FixIconImage(FixIcon.Return, Color.White, Modifier.size(18.dp))
        }
    }
}

/** The report's progress at the top of the screen. */
@Composable
internal fun BoxScope.FixBanner(banner: FixSession.Banner?) {
    // Kept through the slide-out, after the session has let go of it.
    val last = remember { object { var banner: FixSession.Banner? = null } }
    banner?.let { last.banner = it }

    AnimatedVisibility(
        visible = banner != null,
        modifier = Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 6.dp),
        enter = slideInVertically { -it } + fadeIn(),
        exit = slideOutVertically { -it } + fadeOut(),
    ) {
        val shown = last.banner ?: return@AnimatedVisibility
        Row(
            Modifier
                .testTag(fixTag("banner"))
                .semantics(mergeDescendants = true) {}
                .shadow(14.dp, CircleShape)
                .background(fixTint, CircleShape)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (shown.icon == null) Spinner() else FixIconImage(shown.icon, Color.White, Modifier.size(16.dp))
            BasicText(shown.text, style = TextStyle(color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold))
        }
    }
}

/**
 * A turning arc, drawn and turned in the layer alone: nothing about it reaches the accessibility
 * tree, whose reader waits for the screen to keep still.
 */
@Composable
private fun Spinner() {
    val turn by rememberInfiniteTransition(label = "composablefix.spinner").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "composablefix.spinner",
    )
    Canvas(Modifier.size(16.dp).graphicsLayer { rotationZ = turn }) {
        drawArc(Color.White, 0f, 270f, false, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round))
    }
}

/** The few icons ComposableFix draws, from Material Icons' paths, so the library needs no icon package. */
internal enum class FixIcon(val path: String) {
    Sparkle(
        "M19,9l1.25,-2.75L23,5l-2.75,-1.25L19,1l-1.25,2.75L15,5l2.75,1.25L19,9zM11.5,9.5L9,4 6.5,9.5 1,12l5.5,2.5L9,20" +
            "l2.5,-5.5L17,12l-5.5,-2.5zM19,15l-1.25,2.75L15,19l2.75,1.25L19,23l1.25,-2.75L23,19l-2.75,-1.25L19,15z",
    ),
    Return("M19,7v4H5.83l3.58,-3.59L8,6l-6,6 6,6 1.41,-1.41L5.83,13H21V7z"),
    Fixed(
        "M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM10,17l-5,-5 1.41,-1.41L10,14.17" +
            "l7.59,-7.59L19,8l-9,9z",
    ),
    Failed(
        "M12,2C6.47,2 2,6.47 2,12s4.47,10 10,10 10,-4.47 10,-10S17.53,2 12,2zM17,15.59L15.59,17 12,13.41 8.41,17 7,15.59" +
            " 10.59,12 7,8.41 8.41,7 12,10.59 15.59,7 17,8.41 13.41,12 17,15.59z",
    ),
    Offline(
        "M19.35,10.04C18.67,6.59 15.64,4 12,4c-1.48,0 -2.85,0.43 -4.01,1.17l1.46,1.46C10.21,6.23 11.08,6 12,6" +
            "c3.04,0 5.5,2.46 5.5,5.5v0.5H19c1.66,0 3,1.34 3,3 0,1.13 -0.64,2.11 -1.56,2.62l1.45,1.45C23.16,18.16 24,16.68 24,15" +
            "c0,-2.64 -2.05,-4.78 -4.65,-4.96zM3,5.27l2.75,2.74C2.56,8.15 0,10.77 0,14c0,3.31 2.69,6 6,6h11.73l2,2L21,20.73 4.27,4" +
            " 3,5.27zM7.73,10l8,8H6c-2.21,0 -4,-1.79 -4,-4s1.79,-4 4,-4h1.73z",
    ),
    ;

    val vector: ImageVector by lazy {
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
            .addPath(addPathNodes(path), fill = SolidColor(Color.Black))
            .build()
    }
}

@Composable
private fun FixIconImage(icon: FixIcon, tint: Color, modifier: Modifier) {
    Image(icon.vector, contentDescription = null, modifier = modifier, colorFilter = ColorFilter.tint(tint))
}
