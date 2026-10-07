package dev.composablefix.tally.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.SectionHeader
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.card
import dev.composablefix.tally.app.ui
import dev.composablefix.tally.data.SampleData

@Composable
fun HomeScreen() {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 8.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Header()
        BalanceSummary()
        WalletCard(SampleData.cards[0], Modifier.fixable("home.walletCard"))
        QuickActions()
        RecentActivity()
    }
}

@Composable
private fun Header() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
            Modifier
                .size(42.dp)
                .background(Theme.accent, CircleShape)
                .fixable("home.header.avatar"),
            contentAlignment = Alignment.Center,
        ) {
            Text("VB", style = ui(15, FontWeight.Bold), color = Theme.background)
        }

        Column(Modifier.fixable("home.header.greeting"), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Good morning", style = ui(13), color = Theme.textSecondary)
            Text(SampleData.OWNER_FIRST_NAME, style = ui(18, FontWeight.SemiBold), color = Theme.textPrimary)
        }

        Spacer(Modifier.weight(1f))

        Box(
            Modifier
                .size(42.dp)
                .background(Theme.surface, CircleShape)
                .fixable("home.header.notifications"),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Notifications, contentDescription = "Notifications", tint = Theme.textPrimary, modifier = Modifier.size(20.dp))
            Box(
                Modifier
                    .offset(x = 6.dp, y = (-6).dp)
                    .size(8.dp)
                    .background(Theme.negative, CircleShape),
            )
        }
    }
}

@Composable
private fun RecentActivity() {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionHeader("Recent activity", Modifier.fixable("home.recentActivity.header"), action = "See all")

        Column(Modifier.card(padding = 4.dp)) {
            val recent = SampleData.recentTransactions
            for (transaction in recent) {
                TransactionRow(transaction)
                if (transaction != recent.last()) {
                    HorizontalDivider(Modifier.padding(start = 58.dp), thickness = 1.dp, color = Theme.stroke)
                }
            }
        }
    }
}

@Preview
@Composable
private fun HomeScreenPreview() {
    Box(Modifier.background(Theme.background)) { HomeScreen() }
}
