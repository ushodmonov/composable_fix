package dev.composablefix.tally.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NorthEast
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.Money
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.mono
import dev.composablefix.tally.app.ui
import dev.composablefix.tally.data.SampleData

@Composable
fun BalanceSummary() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Total balance", style = ui(14), color = Theme.textSecondary)

        Text(
            Money.string(SampleData.balance),
            style = mono(40, FontWeight.Bold),
            color = Theme.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Clip,
            modifier = Modifier.fixable("home.balance.amount"),
        )

        Row(
            Modifier
                .background(Theme.positive.copy(alpha = 0.14f), CircleShape)
                .padding(horizontal = 10.dp, vertical = 6.dp)
                .fixable("home.balance.monthDelta"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(Icons.Filled.NorthEast, contentDescription = null, tint = Theme.positive, modifier = Modifier.size(12.dp))
            Text("${Money.string(SampleData.monthDelta)} this month", style = ui(13, FontWeight.Medium), color = Theme.positive)
        }
    }
}
