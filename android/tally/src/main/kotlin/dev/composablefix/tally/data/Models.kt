package dev.composablefix.tally.data

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.ShoppingBasket
import androidx.compose.material.icons.filled.SouthWest
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime

enum class SpendingCategory(
    val title: String,
    /** Fits under a chart bar. */
    val shortName: String,
    val icon: ImageVector,
) {
    Groceries("Groceries", "Food", Icons.Filled.ShoppingBasket),
    Transport("Transport", "Rides", Icons.Filled.DirectionsCar),
    Dining("Dining", "Dining", Icons.Filled.Restaurant),
    Subscriptions("Subscriptions", "Subs", Icons.Filled.Repeat),
    Shopping("Shopping", "Shop", Icons.Filled.ShoppingBag),
    Travel("Travel", "Travel", Icons.Filled.Flight),
    Income("Income", "Income", Icons.Filled.SouthWest),
}

data class Transaction(
    val id: Int,
    val merchant: String,
    val note: String,
    val category: SpendingCategory,
    /** Positive for money in, negative for money out. */
    val amount: BigDecimal,
    val date: LocalDateTime,
) {
    val isIncome get() = amount.signum() > 0
}

data class PaymentCard(
    val id: Int,
    val name: String,
    val holder: String,
    val lastFour: String,
    val expiry: String,
    val network: String,
    val gradient: List<Color>,
    val monthlyLimit: BigDecimal,
    val spentThisMonth: BigDecimal,
    val isFrozen: Boolean,
    val allowsOnlinePayments: Boolean,
)

data class DaySection(val day: LocalDate, val transactions: List<Transaction>) {
    val total: BigDecimal get() = transactions.fold(BigDecimal.ZERO) { sum, transaction -> sum + transaction.amount }
}

data class CategoryTotal(val category: SpendingCategory, val total: BigDecimal)
