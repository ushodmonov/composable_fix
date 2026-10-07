package dev.composablefix.tally.features.activity

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.SectionHeader
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.card
import dev.composablefix.tally.app.mono
import dev.composablefix.tally.app.ui
import dev.composablefix.tally.data.SampleData

@Composable
fun SpendingChart() {
    val totals = SampleData.spendingByCategory
    // The axis tops out at the next round hundred above the largest bar, in three steps.
    val top = ((totals.maxOf { it.total.toDouble() } / 300).toInt() + 1) * 300
    val steps = listOf(top, top * 2 / 3, top / 3, 0)

    Column(
        Modifier
            .card()
            .fixable("activity.spendingChart"),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionHeader("Spending by category", action = "30 days")

        Row(Modifier.fillMaxWidth().height(180.dp)) {
            Column(Modifier.fillMaxHeight().padding(bottom = 18.dp), verticalArrangement = Arrangement.SpaceBetween) {
                for (step in steps) {
                    Text("€$step", style = mono(10), color = Theme.textSecondary)
                }
            }

            Column(Modifier.weight(1f).padding(start = 8.dp)) {
                Row(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .drawBehind {
                            for (index in steps.indices) {
                                val y = size.height * index / (steps.size - 1)
                                drawLine(Theme.stroke, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.dp.toPx())
                            }
                        },
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.Bottom,
                ) {
                    for (item in totals) {
                        Box(
                            Modifier
                                .width(22.dp)
                                .fillMaxHeight(item.total.toFloat() / top)
                                .background(Theme.chartMark, RoundedCornerShape(topStart = 7.dp, topEnd = 7.dp))
                                .semantics { contentDescription = "${item.category.shortName}, €${item.total.toInt()}" },
                        )
                    }
                }

                Row(Modifier.fillMaxWidth().height(18.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Bottom) {
                    for (item in totals) {
                        Text(item.category.shortName, style = ui(10, FontWeight.Medium), color = Theme.textSecondary)
                    }
                }
            }
        }
    }
}
