package dev.composablefix

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// ComposableFix in a release build: the same API as the debug library, doing nothing.
// Depend on it with releaseImplementation and on :composablefix with debugImplementation.

/** Returns the modifier unchanged. */
@Suppress("UNUSED_PARAMETER")
fun Modifier.fixable(name: String): Modifier = this

/** Returns the modifier unchanged. */
@Suppress("UNUSED_PARAMETER")
fun Modifier.fixScreen(name: String): Modifier = this

/** Draws the content and nothing else. */
@Composable
fun ComposableFixHost(content: @Composable () -> Unit) {
    content()
}
