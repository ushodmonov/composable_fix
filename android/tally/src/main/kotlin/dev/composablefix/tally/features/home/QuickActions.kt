package dev.composablefix.tally.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.NorthEast
import androidx.compose.material.icons.filled.SouthWest
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.composablefix.fixable
import dev.composablefix.tally.app.Theme
import dev.composablefix.tally.app.ui

@Composable
fun QuickActions() {
    Row(verticalAlignment = Alignment.Top) {
        QuickActionButton(
            "Send", Icons.Filled.NorthEast,
            Modifier.weight(1f).offset(x = 16.dp, y = 10.dp).fixable("home.quickActions.send"),
        )
        QuickActionButton("Request", Icons.Filled.SouthWest, Modifier.weight(1f).fixable("home.quickActions.request"))
        QuickActionButton("Top up", Icons.Filled.Add, Modifier.weight(1f).fixable("home.quickActions.topUp"), cornerRadius = 2.dp)
        QuickActionButton("More", Icons.Filled.MoreHoriz, Modifier.weight(1f).fixable("home.quickActions.more"))
    }
}

@Composable
fun QuickActionButton(title: String, icon: ImageVector, modifier: Modifier = Modifier, cornerRadius: Dp = 20.dp) {
    val shape = RoundedCornerShape(cornerRadius)

    Column(
        modifier.clickable(role = Role.Button) {},
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier
                .size(60.dp)
                .background(Theme.surfaceRaised, shape)
                .border(1.dp, Theme.stroke, shape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = Theme.accent, modifier = Modifier.size(24.dp))
        }

        Text(title, style = ui(13, FontWeight.Medium), color = Theme.textPrimary)
    }
}
