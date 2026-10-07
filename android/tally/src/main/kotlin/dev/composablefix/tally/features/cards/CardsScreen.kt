package dev.composablefix.tally.features.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.Money
import dev.composablefix.tally.app.SectionHeader
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.card
import dev.composablefix.tally.app.mono
import dev.composablefix.tally.app.ui
import dev.composablefix.tally.data.PaymentCard
import dev.composablefix.tally.data.SampleData
import dev.composablefix.tally.features.home.WalletCard
import java.math.MathContext

@Composable
fun CardsScreen() {
    val cards = remember { mutableStateListOf(*SampleData.cards.toTypedArray()) }
    val pager = rememberPagerState { cards.size }
    val selected = pager.currentPage

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(top = 8.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        Text(
            "Cards",
            style = ui(30, FontWeight.Bold),
            color = Theme.textPrimary,
            modifier = Modifier.padding(horizontal = 20.dp).fixable("cards.title"),
        )

        HorizontalPager(
            pager,
            contentPadding = PaddingValues(horizontal = 20.dp),
            pageSpacing = 14.dp,
            modifier = Modifier.padding(bottom = 4.dp),
        ) { page ->
            WalletCard(cards[page])
        }

        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            Limit(cards[selected])
            Settings(cards[selected]) { cards[selected] = it }
            Details()
        }
    }
}

@Composable
private fun Limit(card: PaymentCard) {
    val progress = card.spentThisMonth.divide(card.monthlyLimit, MathContext.DECIMAL32).toFloat()

    Column(
        Modifier.fillMaxWidth().card().fixable("cards.monthlyLimit"),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SectionHeader("Monthly limit")

        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(Money.string(card.spentThisMonth), style = mono(22, FontWeight.Bold), color = Theme.textPrimary)
            Text("of ${Money.string(card.monthlyLimit)}", style = ui(13), color = Theme.textSecondary, modifier = Modifier.padding(bottom = 3.dp))
        }

        LinearProgressIndicator(
            progress = { progress.coerceAtMost(1f) },
            modifier = Modifier.fillMaxWidth().height(7.dp),
            color = card.gradient[1],
            trackColor = Theme.surfaceRaised,
            strokeCap = StrokeCap.Round,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )
    }
}

@Composable
private fun Settings(card: PaymentCard, onChange: (PaymentCard) -> Unit) {
    Column(Modifier.card(padding = 4.dp)) {
        SettingRow(
            "Freeze card", "Block all payments instantly", Icons.Filled.AcUnit,
            isOn = card.isFrozen, onChange = { onChange(card.copy(isFrozen = it)) },
            modifier = Modifier.fixable("cards.settings.freeze"),
        )

        HorizontalDivider(Modifier.padding(start = 58.dp), thickness = 1.dp, color = Theme.stroke)

        SettingRow(
            "Online payments", "Allow purchases on the web", Icons.Filled.Public,
            isOn = card.allowsOnlinePayments, onChange = { onChange(card.copy(allowsOnlinePayments = it)) },
            modifier = Modifier.fixable("cards.settings.onlinePayments"),
        )
    }
}

@Composable
private fun Details() {
    Column(
        Modifier.fillMaxWidth().card().fixable("cards.accountDetails"),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SectionHeader("Account details")

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("IBAN", style = ui(12), color = Theme.textSecondary)
            Text(SampleData.IBAN, style = mono(14, FontWeight.SemiBold), color = Theme.textPrimary)
        }
    }
}

@Composable
private fun SettingRow(
    title: String,
    subtitle: String,
    icon: ImageVector,
    isOn: Boolean,
    onChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(42.dp).background(Theme.surfaceRaised, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Theme.iconInk, modifier = Modifier.size(18.dp))
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = ui(15, FontWeight.Medium), color = Theme.textPrimary)
            Text(subtitle, style = ui(12), color = Theme.textSecondary)
        }

        Switch(
            checked = isOn,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = Theme.accent, checkedThumbColor = Theme.background),
        )
    }
}

@Preview
@Composable
private fun CardsScreenPreview() {
    Box(Modifier.background(Theme.background)) { CardsScreen() }
}
