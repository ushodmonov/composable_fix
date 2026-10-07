package dev.composablefix.tally.features.activity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NorthEast
import androidx.compose.material.icons.filled.SouthWest
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.Money
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.card
import dev.composablefix.tally.app.mono
import dev.composablefix.tally.app.ui
import dev.composablefix.tally.data.SampleData
import dev.composablefix.tally.features.home.TransactionRow
import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun ActivityScreen() {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        item {
            Text(
                "Activity",
                style = ui(30, FontWeight.Bold),
                color = Theme.textPrimary,
                modifier = Modifier.fixable("activity.title"),
            )
        }
        item { Totals() }
        item { SpendingChart() }

        items(SampleData.days, key = { it.day }) { section ->
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fixable("activity.dayHeader"), verticalAlignment = Alignment.CenterVertically) {
                    Text(title(section.day), style = ui(14, FontWeight.SemiBold), color = Theme.textSecondary)
                    Spacer(Modifier.weight(1f))
                    Text(Money.signed(section.total), style = mono(13), color = Theme.textSecondary)
                }

                Column(Modifier.card(padding = 4.dp)) {
                    for (transaction in section.transactions) {
                        TransactionRow(transaction)
                    }
                }
            }
        }
    }
}

@Composable
private fun Totals() {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        TotalTile(
            "Spent", SampleData.totalSpent, Icons.Filled.NorthEast, Theme.negative,
            Modifier.weight(1f).fixable("activity.totals.spent"),
        )
        TotalTile(
            "Received", SampleData.totalIncome, Icons.Filled.SouthWest, Theme.positive,
            Modifier.weight(1f).fixable("activity.totals.received"),
        )
    }
}

private val dayFormat = DateTimeFormatter.ofPattern("EEEE, d MMM", Locale.ENGLISH)

private fun title(day: LocalDate) = when (day) {
    LocalDate.now() -> "Today"
    LocalDate.now().minusDays(1) -> "Yesterday"
    else -> day.format(dayFormat)
}

@Composable
private fun TotalTile(title: String, amount: BigDecimal, icon: ImageVector, tint: Color, modifier: Modifier) {
    Column(modifier.card(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(12.dp))
            Text(title, style = ui(13, FontWeight.Medium), color = Theme.textSecondary)
        }
        Text(Money.string(amount), style = mono(19, FontWeight.Bold), color = Theme.textPrimary, maxLines = 1)
    }
}

@Preview
@Composable
private fun ActivityScreenPreview() {
    Box(Modifier.background(Theme.background)) { ActivityScreen() }
}
