package dev.composablefix.tally.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.mono
import dev.composablefix.tally.app.ui
import dev.composablefix.tally.data.PaymentCard

@Composable
fun WalletCard(card: PaymentCard, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(26.dp)
    // A frozen card is drawn nearly grey.
    val colors = card.gradient.map { if (card.isFrozen) lerp(it, Color(it.luminance(), it.luminance(), it.luminance()), 0.8f) else it }

    Box(
        modifier
            .fillMaxWidth()
            .height(200.dp)
            .shadow(22.dp, shape, ambientColor = colors[0], spotColor = colors[0])
            .clip(shape)
            .background(Brush.linearGradient(colors))
            .drawBehind {
                drawCircle(Color.White.copy(alpha = 0.12f), radius = 110.dp.toPx(), center = Offset(size.width / 2 + 130.dp.toPx(), size.height / 2 - 90.dp.toPx()))
                drawCircle(Color.White.copy(alpha = 0.08f), radius = 90.dp.toPx(), center = Offset(size.width / 2 - 150.dp.toPx(), size.height / 2 + 110.dp.toPx()))
            },
    ) {
        Column(Modifier.fillMaxSize().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(card.name, style = ui(15, FontWeight.SemiBold), color = Color.White)
                Spacer(Modifier.weight(1f))
                Icon(Icons.Filled.Contactless, contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
            }

            Spacer(Modifier.weight(1f))

            Text(
                "••••  ••••  ••••  ${card.lastFour}",
                style = mono(20, FontWeight.SemiBold),
                color = Color.White,
                modifier = Modifier.fixable("card.number"),
            )

            Spacer(Modifier.weight(1f))

            Row(verticalAlignment = Alignment.Bottom) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("CARD HOLDER", style = ui(9, FontWeight.Medium), color = Color.White.copy(alpha = 0.7f))
                    Text(
                        card.holder,
                        style = ui(14, FontWeight.Medium),
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.width(110.dp).fixable("card.holderName"),
                    )
                }

                Spacer(Modifier.weight(1f))

                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("EXPIRES", style = ui(9, FontWeight.Medium), color = Color.White.copy(alpha = 0.7f))
                    Text(card.expiry, style = mono(14, FontWeight.SemiBold), color = Color.White)
                }

                Spacer(Modifier.weight(1f))

                Text(card.network, style = ui(17, FontWeight.Bold).copy(fontStyle = FontStyle.Italic), color = Color.White)
            }
        }
    }
}
