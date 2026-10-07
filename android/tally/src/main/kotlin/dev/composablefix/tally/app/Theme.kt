package dev.composablefix.tally.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.composablefix.tally.R
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

object Theme {
    val background = Color(0.035f, 0.043f, 0.071f)
    val surface = Color(0.082f, 0.094f, 0.141f)
    val surfaceRaised = Color(0.118f, 0.133f, 0.192f)
    val stroke = Color.White.copy(alpha = 0.07f)
    val accent = Color(0.38f, 0.93f, 0.69f)
    val positive = Color(0.38f, 0.93f, 0.69f)
    val negative = Color(1.00f, 0.42f, 0.45f)
    val textPrimary = Color.White
    val textSecondary = Color.White.copy(alpha = 0.56f)

    /** Icons that label rather than act: neutral, so colour is left to mean something. */
    val iconInk = Color.White.copy(alpha = 0.78f)

    /** Chart marks: a neutral tinted from the background's navy, not a hue per category. */
    val chartMark = Color(0.60f, 0.66f, 0.84f)
    val cornerRadius = 22.dp
}

/** iA Writer Mono, for amounts and card numbers: one variable font, set to each weight. */
@OptIn(ExperimentalTextApi::class)
private val monoFamily = FontFamily(
    listOf(FontWeight.Normal, FontWeight.SemiBold, FontWeight.Bold).map { weight ->
        Font(R.font.ia_writer_mono, weight, variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)))
    },
)

/** The interface font: the system's Roboto. */
fun ui(size: Int, weight: FontWeight = FontWeight.Normal) = TextStyle(fontSize = size.sp, fontWeight = weight)

fun mono(size: Int, weight: FontWeight = FontWeight.Normal) =
    TextStyle(fontSize = size.sp, fontWeight = weight, fontFamily = monoFamily)

object Money {
    private val format = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("en-IE")).apply {
        currency = Currency.getInstance("EUR")
    }

    fun string(amount: BigDecimal): String = format.format(amount.abs())

    /** "+€64.95" for money in, "−€7.40" for money out. */
    fun signed(amount: BigDecimal) = (if (amount.signum() > 0) "+" else "−") + string(amount)
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier, action: String? = null) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = ui(18, FontWeight.SemiBold), color = Theme.textPrimary)
        Spacer(Modifier.weight(1f))
        if (action != null) {
            Text(action, style = ui(14, FontWeight.Medium), color = Theme.accent)
        }
    }
}

fun Modifier.card(padding: Dp = 16.dp): Modifier {
    val shape = RoundedCornerShape(Theme.cornerRadius)
    return this
        .background(Theme.surface, shape)
        .border(1.dp, Theme.stroke, shape)
        .padding(padding)
}
