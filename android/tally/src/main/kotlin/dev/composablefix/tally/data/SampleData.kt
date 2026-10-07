package dev.composablefix.tally.data

import androidx.compose.ui.graphics.Color
import java.math.BigDecimal
import java.time.LocalDate

/** Deterministic stub data: every launch shows the same account. */
object SampleData {
    const val OWNER_FIRST_NAME = "Vladimir"
    const val OWNER_FULL_NAME = "Vladimir Berestnev"
    val balance = BigDecimal("12480.56")
    val monthDelta = BigDecimal("842.10")
    const val IBAN = "DE89 3704 0044 0532 0130 00"

    /** The day the stubs are anchored to, so "Today" stays today in every take. */
    val today: LocalDate = LocalDate.now()

    val cards = listOf(
        PaymentCard(
            id = 1, name = "Everyday", holder = OWNER_FULL_NAME, lastFour = "4821", expiry = "09/29",
            network = "VISA",
            gradient = listOf(Color(0.36f, 0.31f, 0.95f), Color(0.13f, 0.76f, 0.84f)),
            monthlyLimit = BigDecimal("3000"), spentThisMonth = BigDecimal("1184.37"),
            isFrozen = false, allowsOnlinePayments = true,
        ),
        PaymentCard(
            id = 2, name = "Travel", holder = OWNER_FULL_NAME, lastFour = "0937", expiry = "02/28",
            network = "Mastercard",
            gradient = listOf(Color(0.98f, 0.45f, 0.36f), Color(0.93f, 0.25f, 0.56f)),
            monthlyLimit = BigDecimal("5000"), spentThisMonth = BigDecimal("2316.90"),
            isFrozen = false, allowsOnlinePayments = true,
        ),
        PaymentCard(
            id = 3, name = "Savings", holder = OWNER_FULL_NAME, lastFour = "7710", expiry = "11/30",
            network = "VISA",
            gradient = listOf(Color(0.11f, 0.14f, 0.22f), Color(0.22f, 0.29f, 0.42f)),
            monthlyLimit = BigDecimal("1000"), spentThisMonth = BigDecimal("96.00"),
            isFrozen = true, allowsOnlinePayments = false,
        ),
    )

    private class Row(
        val daysAgo: Long, val hour: Int, val minute: Int,
        val merchant: String, val note: String, val category: SpendingCategory, val amount: String,
    )

    val transactions: List<Transaction> = listOf(
        Row(0, 9, 12, "Five Elephant", "Flat white, croissant", SpendingCategory.Dining, "-7.40"),
        Row(0, 8, 31, "BVG", "Single ticket AB", SpendingCategory.Transport, "-3.50"),
        Row(0, 7, 2, "Northwind GmbH", "Salary, September", SpendingCategory.Income, "4650.00"),
        Row(1, 20, 44, "Uber", "Mitte → Kreuzberg", SpendingCategory.Transport, "-14.80"),
        Row(1, 19, 5, "Mustafa's Gemüse Kebap", "Dinner", SpendingCategory.Dining, "-9.50"),
        Row(1, 13, 20, "Lidl", "Groceries", SpendingCategory.Groceries, "-43.18"),
        Row(1, 10, 0, "Spotify", "Premium Family", SpendingCategory.Subscriptions, "-17.99"),
        Row(2, 18, 37, "Apple", "iCloud+ 200 GB", SpendingCategory.Subscriptions, "-2.99"),
        Row(2, 16, 2, "Zalando", "Refund, order 10482", SpendingCategory.Income, "64.95"),
        Row(2, 12, 48, "REWE", "Groceries", SpendingCategory.Groceries, "-61.72"),
        Row(3, 21, 15, "Netflix", "Standard plan", SpendingCategory.Subscriptions, "-13.99"),
        Row(3, 17, 30, "Decathlon", "Running shoes", SpendingCategory.Shopping, "-89.99"),
        Row(3, 8, 50, "Deutsche Bahn", "Berlin → Hamburg", SpendingCategory.Travel, "-37.90"),
        Row(4, 19, 55, "Lieferando", "Sushi for two", SpendingCategory.Dining, "-34.60"),
        Row(4, 14, 10, "DM", "Household", SpendingCategory.Groceries, "-22.35"),
        Row(5, 22, 3, "Bolt", "Scooter ride", SpendingCategory.Transport, "-4.20"),
        Row(5, 11, 41, "IKEA", "Shelf, lamp", SpendingCategory.Shopping, "-128.00"),
        Row(6, 20, 18, "Lufthansa", "BER → LIS", SpendingCategory.Travel, "-214.30"),
        Row(6, 9, 9, "Anna Becker", "Split: weekend trip", SpendingCategory.Income, "120.00"),
        Row(7, 18, 26, "Edeka", "Groceries", SpendingCategory.Groceries, "-38.04"),
        Row(7, 13, 0, "Vapiano", "Lunch", SpendingCategory.Dining, "-16.90"),
        Row(8, 15, 47, "Amazon", "USB-C hub", SpendingCategory.Shopping, "-45.99"),
        Row(8, 8, 15, "BVG", "Monthly pass", SpendingCategory.Transport, "-58.00"),
        Row(9, 19, 33, "Booking.com", "Lisbon, 3 nights", SpendingCategory.Travel, "-342.00"),
        Row(10, 12, 12, "Lidl", "Groceries", SpendingCategory.Groceries, "-29.87"),
        Row(10, 10, 30, "GitHub", "Copilot", SpendingCategory.Subscriptions, "-10.00"),
        Row(11, 21, 2, "Zur Letzten Instanz", "Dinner", SpendingCategory.Dining, "-58.40"),
        Row(12, 16, 45, "Uniqlo", "Jacket", SpendingCategory.Shopping, "-79.90"),
        Row(12, 9, 20, "Uber", "Airport transfer", SpendingCategory.Transport, "-31.60"),
        Row(13, 18, 8, "REWE", "Groceries", SpendingCategory.Groceries, "-54.11"),
        Row(14, 11, 11, "Tax Office Berlin", "Tax refund 2025", SpendingCategory.Income, "318.42"),
        Row(15, 20, 40, "Yorck Kinos", "2 tickets", SpendingCategory.Dining, "-24.00"),
        Row(16, 13, 25, "MediaMarkt", "Headphones", SpendingCategory.Shopping, "-149.00"),
        Row(17, 8, 5, "Flixbus", "Berlin → Prague", SpendingCategory.Travel, "-19.99"),
        Row(18, 19, 19, "Edeka", "Groceries", SpendingCategory.Groceries, "-47.63"),
        Row(19, 10, 10, "Notion", "Plus plan", SpendingCategory.Subscriptions, "-9.50"),
        Row(20, 14, 52, "Tier", "Scooter ride", SpendingCategory.Transport, "-3.80"),
        Row(21, 20, 6, "Burgermeister", "Dinner", SpendingCategory.Dining, "-13.20"),
        Row(22, 12, 0, "Max Schulz", "Rent share", SpendingCategory.Income, "410.00"),
        Row(23, 17, 17, "Airbnb", "Prague, 2 nights", SpendingCategory.Travel, "-168.00"),
    ).mapIndexed { index, row ->
        Transaction(
            id = index, merchant = row.merchant, note = row.note, category = row.category,
            amount = BigDecimal(row.amount),
            date = today.minusDays(row.daysAgo).atTime(row.hour, row.minute),
        )
    }

    val recentTransactions get() = transactions.take(6)

    val days: List<DaySection>
        get() = transactions
            .groupBy { it.date.toLocalDate() }
            .map { (day, transactions) -> DaySection(day, transactions.sortedByDescending { it.date }) }
            .sortedByDescending { it.day }

    val spendingByCategory: List<CategoryTotal>
        get() = transactions
            .filter { !it.isIncome }
            .groupBy { it.category }
            .map { (category, transactions) -> CategoryTotal(category, transactions.fold(BigDecimal.ZERO) { sum, t -> sum - t.amount }) }
            .sortedByDescending { it.total }

    val totalSpent: BigDecimal get() = spendingByCategory.fold(BigDecimal.ZERO) { sum, item -> sum + item.total }
    val totalIncome: BigDecimal
        get() = transactions.filter { it.isIncome }.fold(BigDecimal.ZERO) { sum, t -> sum + t.amount }
}
