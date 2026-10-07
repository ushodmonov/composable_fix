package dev.composablefix

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FixRegistryTest {
    private fun element(name: String, frame: Rect) = FixElement(name, FixSource("app/$name.kt", 1), frame)

    @Test
    fun innermostElementWins() {
        val registry = FixRegistry()
        registry.update(Any(), element("card", Rect(0f, 0f, 300f, 200f)))
        registry.update(Any(), element("card.name", Rect(20f, 150f, 140f, 170f)))

        assertEquals("card.name", registry.element(Offset(40f, 160f))?.name)
        assertEquals("card", registry.element(Offset(250f, 40f))?.name)
    }

    @Test
    fun ofTwoAlikeTheInnerOneWins() {
        // A mark on a view and one on its only child share a frame; the child attaches later.
        val registry = FixRegistry()
        registry.update(Any(), element("row", Rect(0f, 0f, 300f, 60f)))
        registry.update(Any(), element("row.text", Rect(0f, 0f, 300f, 60f)))

        assertEquals("row.text", registry.element(Offset(10f, 10f))?.name)
    }

    @Test
    fun nothingMarkedUnderThePoint() {
        val registry = FixRegistry()
        registry.update(Any(), element("card", Rect(0f, 0f, 300f, 200f)))

        assertNull(registry.element(Offset(10f, 400f)))
    }

    @Test
    fun anElementScrolledAwayIsNeverPressed() {
        val registry = FixRegistry()
        registry.update(Any(), element("row", Rect(0f, 0f, 300f, 0f)))

        assertNull(registry.element(Offset(10f, 0f)))
    }

    @Test
    fun removedElementIsForgotten() {
        val registry = FixRegistry()
        val key = Any()
        registry.update(key, element("card", Rect(0f, 0f, 300f, 200f)))
        registry.remove(key)

        assertNull(registry.element("card"))
    }

    @Test
    fun theCallersPackageGivesTheFolders() {
        assertEquals(
            FixSource("dev/composablefix/tally/home/WalletCard.kt", 42),
            sourceOf("dev.composablefix.tally.home.WalletCardKt", "WalletCard.kt", 42),
        )
        // A lambda's class carries the function it is in after a dollar sign.
        assertEquals(
            FixSource("dev/composablefix/tally/home/QuickActions.kt", 9),
            sourceOf("dev.composablefix.tally.home.ComposableSingletons\$QuickActionsKt\$lambda-1\$1", "QuickActions.kt", 9),
        )
        assertEquals(FixSource("Main.kt", 3), sourceOf("MainKt", "Main.kt", 3))
    }
}
