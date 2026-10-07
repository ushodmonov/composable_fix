package dev.composablefix.tally.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import dev.composablefix.tally.data.Transaction
import java.time.format.DateTimeFormatter

private val timeFormat = DateTimeFormatter.ofPattern("HH:mm")

@Composable
fun TransactionRow(transaction: Transaction) {
    Row(
        Modifier
            .padding(horizontal = 12.dp, vertical = 11.dp)
            .fixable("transaction.row.${transaction.merchant}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(42.dp).background(Theme.surfaceRaised, CircleShape), contentAlignment = Alignment.Center) {
            Icon(transaction.category.icon, contentDescription = null, tint = Theme.iconInk, modifier = Modifier.size(18.dp))
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                transaction.merchant, style = ui(15, FontWeight.Medium), color = Theme.textPrimary,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            Text(
                transaction.note, style = ui(12), color = Theme.textSecondary,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }

        Spacer(Modifier.width(8.dp))

        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                Money.signed(transaction.amount),
                style = mono(15, FontWeight.SemiBold),
                color = if (transaction.isIncome) Theme.negative else Theme.textPrimary,
                modifier = Modifier.fixable("transaction.amount.${transaction.merchant}"),
            )
            Text(transaction.date.format(timeFormat), style = ui(12), color = Theme.textSecondary)
        }
    }
}
