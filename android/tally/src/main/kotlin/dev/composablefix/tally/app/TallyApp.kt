package dev.composablefix.tally.app

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.composablefix.fixScreen
import dev.composablefix.fixable
import dev.composablefix.tally.features.activity.ActivityScreen
import dev.composablefix.tally.features.cards.CardsScreen
import dev.composablefix.tally.features.home.HomeScreen

enum class AppTab(val title: String, val icon: ImageVector) {
    Home("Home", Icons.Filled.Home),
    Activity("Activity", Icons.Filled.BarChart),
    Cards("Cards", Icons.Filled.CreditCard),
}

private const val STORAGE_KEY = "selectedTab"

@Composable
fun TallyApp() {
    val preferences = LocalContext.current.getSharedPreferences("tally", Context.MODE_PRIVATE)
    // Starts on the tab that was open last, so a rebuild reopens the screen that was on display.
    var selectedTab by remember {
        mutableStateOf(AppTab.entries.find { it.title == preferences.getString(STORAGE_KEY, null) } ?: AppTab.Home)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Theme.background)
            .fixScreen(selectedTab.title),
    ) {
        Box(Modifier.weight(1f).fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars)) {
            when (selectedTab) {
                AppTab.Home -> HomeScreen()
                AppTab.Activity -> ActivityScreen()
                AppTab.Cards -> CardsScreen()
            }
        }

        TabBar(selectedTab) { tab ->
            selectedTab = tab
            preferences.edit().putString(STORAGE_KEY, tab.title).apply()
        }
    }
}

@Composable
private fun TabBar(selection: AppTab, onSelect: (AppTab) -> Unit) {
    Column(Modifier.background(Theme.surface).navigationBarsPadding()) {
        HorizontalDivider(thickness = 1.dp, color = Theme.stroke)
        Row(Modifier.padding(horizontal = 12.dp).padding(top = 4.dp)) {
            for (tab in AppTab.entries) {
                val tint = if (selection == tab) Theme.accent else Theme.textSecondary
                Column(
                    Modifier
                        .weight(1f)
                        .selectable(selected = selection == tab, role = Role.Tab) { onSelect(tab) }
                        .padding(vertical = 10.dp)
                        .fixable("tabBar.${tab.title.lowercase()}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Icon(tab.icon, contentDescription = null, tint = tint, modifier = Modifier.size(22.dp))
                    Text(tab.title, style = ui(11, FontWeight.Medium), color = tint)
                }
            }
        }
    }
}
