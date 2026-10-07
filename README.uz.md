# ComposableFix

[English](README.md) | **O'zbekcha** | [Русский](README.ru.md)

Jetpack Compose ilovangizning debug build'idagi istalgan elementni bosib turing, nima noto'g'ri ekanini yozing va Return tugmasini bosing. Hisobot loyihangizda allaqachon ishlab turgan Claude Code sessiyasiga tushadi: element, uni belgilagan Kotlin kodi qatori, skrinshot va sizning so'zlaringiz. Claude kodni tuzatadi, ilovani qayta o'rnatib ishga tushiradi, ilovadagi banner esa tuzatishni navbatga tushganidan to ekranda paydo bo'lguncha kuzatib boradi.

![Android emulyatorida elementlarni bosib turish Claude Code'ga hisobot yuboradi: siljib qolgan tugma, yumaloqlanmagan burchaklar, kesilib qolgan ism va qizil rangdagi daromad summasi, har birini Claude tuzatadi va ilovani qayta o'rnatadi](docs/demo.gif)

[Demoni to'liq sifatda ko'ring (MP4)](docs/demo.mp4). U Android emulyatorida jonli yozib olingan: mod o'rnatilgan Claude Code sessiyasi hisobotlar asosida Tally'dagi ataylab qo'yilgan to'rtta xatoni tuzatdi. Faqat ekran qimirlamay turgan joylar qirqib tashlangan.

ComposableFix — bu iOS simulyatoridagi SwiftUI ilovalari uchun xuddi shu ishni bajaradigan [FixKit](https://github.com/ostiums/fixkit) loyihasining Jetpack Compose'ga ko'chirilgan versiyasi. Flutter ilovalari uchun [WidgetFix](https://github.com/ushodmonov/widget_fix) loyihasiga qarang.

ComposableFix ikki qismdan iborat:

- Claude Code uchun **composablefix mod** hisobotlarni qabul qiladi;
- **ComposableFix Android kutubxonasi** ularni debug build'dan yuboradi. Release build'lar uning o'rniga hech narsa qilmaydigan `composablefix-noop` kutubxonasiga bog'lanadi.

## Talablar

- Claude Code 2.1.287 yoki undan yangisi.
- Node.js 18.2 yoki undan yangisi; mod'ning receiver'i shunda ishlaydi.
- Jetpack Compose 1.10 yoki undan yangisi, skrinshotlar uchun esa Android 8.0 (API 26) yoki undan yangisi. Kutubxona API 23 dan boshlab build bo'ladi; u yerda skrinshotni o'zi chizadi.
- Android emulyatori yoki USB yoxud wireless debugging orqali ulangan qurilma.
- Android SDK platform-tools tarkibidagi adb. U hisobotdagi bosish qaysi elementga tushganini aniqlaydi va qurilmaga Mac'ga ulanish imkonini beradi. Mod uni avval `COMPOSABLEFIX_ADB` dan, so'ng `ANDROID_HOME` va `ANDROID_SDK_ROOT` dan, keyin `PATH` dan, oxirida `~/Library/Android/sdk` dan qidiradi. adb bo'lmasa ham emulyatordan hisobotlar skrinshot va bosilgan nuqta bilan kelaveradi.

## O'rnatish

### 1. Mod

```bash
claude plugin marketplace add ushodmonov/composable_fix
claude plugin install composablefix@composablefix
```

Shundan so'ng mod har bir Claude Code sessiyasida yuklanadi. Sessiya boshlanganda u o'z receiver'ini `127.0.0.1:4747` manzilida ishga tushiradi, sessiya tugaganda esa uni to'xtatadi. WidgetFix mod'i ham shu portni tinglaydi, shuning uchun bitta sessiyada ikkalasidan bittasini yoqing.

### 2. Kutubxona

Kutubxona hali nashr qilinmagan, shuning uchun ushbu repozitoriydagi Android build'ni checkout'dan ulang. Shunda Gradle ikkala koordinatani uning modullari bilan almashtiradi. `settings.gradle.kts` faylida:

```kotlin
includeBuild("../composable_fix/android")
```

Ilova modulining `build.gradle.kts` faylida:

```kotlin
dependencies {
    debugImplementation("dev.composablefix:composablefix:0.1.0")
    releaseImplementation("dev.composablefix:composablefix-noop:0.1.0")
}
```

Yoki `android/` papkasida `./gradlew publishToMavenLocal` ni ishga tushiring: u ikkalasini ham `~/.m2` ga nashr qiladi, so'ng loyiha ularni `mavenLocal()` dan oladi.

### 3. Ildiz atrofida bitta o'rovchi

```kotlin
import dev.composablefix.ComposableFixHost

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            ComposableFixHost {
                App()
            }
        }
    }
}
```

Butun integratsiya shu. Kutubxona debug build'larga `INTERNET` ruxsatini qo'shadi va network security config talab qilmaydi: u receiver bilan oddiy socket orqali gaplashadi, cleartext cheklovi esa socket'larga taalluqli emas. Host nima qilishi keyingi bo'limda tushuntirilgan.

### 4. Loyiha papkasi

Mod hisobotlarni `claude` ishga tushirilgan papkadagi `.composablefix/` papkasiga yozadi, shuning uchun uni loyihaning ildiz papkasida ishga tushiring va `.composablefix/` ni `.gitignore` fayliga qo'shing. Claude skrinshotlarni har safar ruxsat so'ramasdan ochishi uchun loyihaning Claude Code sozlamalarida bunga ruxsat bering:

```json
{ "permissions": { "allow": ["Read(./.composablefix/**)"] } }
```

Gradle install va `adb` buyruqlarini ham ruxsat ro'yxatiga qo'shmasangiz, Claude ularni ishga tushirishdan oldin so'raydi.

## Nega `ComposableFixHost` ildizni o'raydi

Bu composable ishga tushmaguncha kutubxona hech narsa qilmaydi. U beshta ishni bajaradi:

- **Bosib turish.** U har bir bosishni ilovaning o'z gesture'laridan oldin, Compose'ning initial pass bosqichida kuzatadi. Tugmalar, ro'yxatlar va pager'lar ishlashda davom etadi. Bosish yarim soniya qimirlamay tursa, u ComposableFix'ga o'tadi: qolgan qismi iste'mol qilinadi (consume), shu bois barmoq ostidagi tugma bunga javob bermaydi.
- **Izoh oynasi.** U xiralashtirilgan ekranni chizadi: bosilgan element yoritilgan, izoh maydoni esa klaviatura ustida turadi. Agar klaviatura elementni yopib qo'yadigan bo'lsa, u ilovani yuqoriga suradi. Back tugmasi uni yopadi.
- **Banner'lar.** U ekranning yuqori qismida hisobot jarayonini ko'rsatadi: yuborildi, navbatda, tuzatilmoqda, qayta build qilinmoqda, tuzatildi.
- **Ishga tushish signali.** Jarayon boshlanganda u receiver'ga ilova ishga tushganini xabar qiladi. Claude hisobot ustida ishlayotgan paytdagi ishga tushish mod'ga tuzatish ekranga chiqqanini bildiradi: Claude ilovani Gradle orqali o'rnatganmi yoki Android Studio'da Run tugmasini o'zingiz bosganmisiz, farqi yo'q. Qayta ishga tushgach, ilova hisobot jarayonini yana kuzatishda davom etadi. Ekran burilishi yoki qurilma buklanishi sababli qayta yaratilgan activity ishga tushish hisoblanmaydi.
- **Accessibility daraxtidagi test tag'lar.** U `testTagsAsResourceId` ni yoqadi, shuning uchun `Modifier.testTag` hisobotlarda elementning identifikatori sifatida ko'rinadi.

Izoh oynasi va banner'lar `ComposableFixHost` ga berilgan kontent ustida chiziladi. Activity'ning butun `setContent` qismini o'rasa, ular butun ekranni, navigatsiya va tab bar'lar ustidan qoplaydi. Shuning uchun ildizni bir marta o'rang: ikkinchi host ikkinchi izoh oynasini chizadi. Dialog'lar, popup'lar va `ModalBottomSheet` host ustidagi alohida oynalardir, shuning uchun ularning ichida bosib turish hech narsa qilmaydi.

Release build'da `composablefix-noop` xuddi shu funksiyalarni beradi: `ComposableFixHost` faqat kontentni chizadi, belgilar esa modifier'ni o'zgarishsiz qaytaradi. APK ichida kutubxonadan ham, uning ruxsatidan ham hech narsa qolmaydi.

## `Modifier.fixable` bilan ishlash

Hech narsani belgilash shart emas. Belgilar bo'lmasa, receiver ekranning accessibility daraxtini `uiautomator dump` orqali o'qiydi va barmoq ostidagi elementni yonidagi yozuvlar bilan birga nomlaydi. Keyin Claude composable'ni manba kodidan shu yozuvlar bo'yicha qidirib topadi:

```
Income should be green

[fix r1] TextView "+€4,650.00" near "Northwind GmbH", "Salary, September" · Activity screen · dev.composablefix.tally/.MainActivity on emulator-5554 · .composablefix/reports/r1.png
```

Qator oxirida ilovaning launch komponenti va qurilmaning adb serial'i turadi; Claude ilovani qayta ishga tushirishda ulardan foydalanadi. Agar elementning hisobotlari aniq bir qatorni ko'rsatishini istasangiz, uni `Modifier.fixable` bilan belgilang:

```kotlin
@Composable
fun WalletCard(card: PaymentCard, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(card.number, Modifier.fixable("card.number"))
        Text(card.holder, Modifier.width(110.dp).fixable("card.holderName"))
    }
}

WalletCard(card, Modifier.fixable("home.walletCard"))
```

Belgi nimalarni o'zgartiradi:

- **Hisobot elementni va uning qatorini nomlaydi.** Belgi o'zi chaqirilgan fayl va qatorni call stack'dan o'qib yozib oladi. Ilova faylni faqat paket papkalari orqali biladi (`dev/composablefix/tally/features/home/WalletCard.kt`), receiver esa uni loyihaning Kotlin va Java manbalari orasidan topadi. Prompt nom va loyihaga nisbatan yo'l bilan boshlanadi, shuning uchun Claude o'qishni aynan shu qatordan boshlaydi:

  ```
  [fix r2] card.holderName · android/tally/src/main/kotlin/dev/composablefix/tally/features/home/WalletCard.kt:86 · TextView "Vladimir Berestnev" near "CARD HOLDER", "EXPIRES" · dev.composablefix.tally/.MainActivity on emulator-5554 · .composablefix/reports/r2.png
  ```

- **Izoh oynasi elementning ramkasini yoritadi** va unga nom hamda fayl ko'rsatilgan yorliq qo'yadi, skrinshotda esa shu ramka chiziq bilan ajratib ko'rsatiladi. Belgi bo'lmasa, skrinshotda barmoq tekkan joy atrofida halqa paydo bo'ladi.
- **Ichma-ich belgilardan eng ichkisi tanlanadi.** Yuqoridagi misolda karta egasining ismi bosilsa, hisobotda `card.holderName` bo'ladi, kartaning boshqa joyi bosilsa, `home.walletCard`.

Belgini Claude kodini ochishini istagan composable'ga qo'ying: imlo xatosi yoki rang uchun `Text` ning o'ziga, oraliqlar yoki layout uchun konteynerga. Belgi elementni o'zidan oldingi modifier'lar qo'ygan joyda ko'radi, shuning uchun siljitilgan element chizilgan joyni yoritish uchun `Modifier.offset(…).fixable(…)` deb yozing. Nom faqat sizga tushunarli bo'lsa yetarli; unda ma'lumot ham bo'lishi mumkin, masalan, `Modifier.fixable("transaction.amount.${transaction.merchant}")`.

`Modifier.fixScreen("Home")` ekrandagi sahifaga nom beradi. Bu nom har bir hisobotga `Home screen` ko'rinishida qo'shiladi va Claude'ga belgilanmagan elementlarni topishda yordam beradi. Uni har bir ekranning ildiziga qo'ying yoki tab'larni saqlovchi layout'ga `Modifier.fixScreen(selectedTab.title)` deb yozing.

## Ishlatish

1. Debug build'ni emulyator yoki qurilmaga o'rnating va oching.
2. Loyiha papkasida `claude` buyrug'ini ishga tushiring. Fix queue paneli kengligi 144 ustun yoki undan katta terminalda ochiladi; `/fix-queue` uni istalgan kenglikda ochadi.
3. Ilovadagi elementni bosib turing, nima noto'g'ri ekanini yozing va Return tugmasini bosing. Back tugmasi yoki xiralashgan ekranga bosish izoh oynasini yopadi.

Panel va ilovadagi banner `queued`, `fixing`, `rebuilding` va `live` holatlaridan o'tadi. Gradle install task'i yoki `adb install` ishlayotganda hisobot rebuilding holatida ko'rinadi. Claude hisobot ustida ishlayotganda ilova qayta ishga tushsa, hisobot live holatiga o'tadi va Claude ishni javob bilan yakunlasa ham live bo'lib qoladi. Claude bitta hisobot ustida ishlayotganda yuborilgan hisobotlar navbatda kutib turadi.

## Qurilmalar

Ilova receiver'ni avval o'z qurilmasidagi `127.0.0.1:4747` manzilidan, so'ng `10.0.2.2:4747` manzilidan qidiradi: emulyator o'zi ishlayotgan kompyuterni shu manzil bilan ataydi.

| Ilova qayerda ishlaydi | Unga nima kerak |
| --- | --- |
| Android emulyatori | hech narsa |
| USB yoki wireless debugging orqali ulangan qurilma | hech narsa: receiver adb ko'radigan har bir qurilma uchun `adb reverse tcp:4747 tcp:4747` ni o'rnatib turadi |

Receiver portni faqat adb server ishlab turgan bo'lsa ulaydi va uni hech qachon o'zi ishga tushirmaydi. Bir nechta qurilma bo'lsa, hisobotni qaysi biri yuborganini ilova jarayonining id'si (pid) orqali aniqlaydi.

## Qanday ishlaydi

```
app (ComposableFix) ──POST /report──▶ receiver (node, 127.0.0.1:4747) ──adb uiautomator dump──▶ device
        ▲                                    │ one JSON line per report
        │ POST /launched, GET /status        ▼
        └──── .composablefix/status.json ◀── the mod: prompt, Fix queue pane, statuses
```

Ilova hisobotni izoh oynasi yopilgandan keyin yuboradi, receiver esa javob berishdan oldin ekranning accessibility daraxtini o'qiydi; shu paytgacha ilova yangi bosib turishni qabul qilmaydi. Receiver bosilgan nuqta ostidagi eng chuqur nomlangan elementni va o'sha qatordagi yonidagi yozuvlarni tanlaydi, butun daraxtni `.composablefix/reports/<id>.ax.json` sifatida saqlaydi hamda qurilmani va belgilangan elementning manba faylini topadi. Mod prompt'ni yuboradi va system prompt'ga `[fix …]` qatorini tushuntiradigan bo'lim qo'shadi. Mod har bir hisobotning holatini `.composablefix/status.json` fayliga yozadi, ilova esa bu faylni muntazam so'rab turadi (poll qiladi).

Bir vaqtning o'zida faqat bitta sessiya hisobot qabul qiladi: keyinroq boshlangan sessiya 4747-portni o'ziga oladi. `COMPOSABLEFIX_PORT` receiver portini o'zgartiradi, lekin ilova doim 4747-portga yuboradi.

## Misol: Tally

`android/tally/` — asl FixKit'dagi SwiftUI hamyon ilovasining Jetpack Compose versiyasi. Unda xuddi o'sha to'rtta ataylab qo'yilgan UI xatosi bor va u ushbu repozitoriydagi kutubxonaga bog'langan.

```bash
git clone https://github.com/ushodmonov/composable_fix && cd composable_fix
./scripts/reset-demo.sh          # puts the bugs back, builds, installs and launches Tally
claude --plugin-dir ./mod        # the mod from this checkout
```

| Qayerda | Nimani bosib turish kerak | Ishlaydigan izoh |
| --- | --- | --- |
| Home | Send tugmasi | button is shifted |
| Home | Top up tugmasi | corners don't match the others |
| Home yoki Cards | karta egasining ismi | name is cut off |
| Home yoki Activity | yashil kategoriyadagi summa, masalan, maosh | income should be green |

Har biri koddagi bir qatorlik kichik xato. Reset skripti ularni `demo-start` git tag'idan, ya'ni xatolar qo'yilgan commit'dan tiklaydi. U ilovani adb ko'rib turgan qurilmaga o'rnatadi; bir nechta qurilma bo'lsa, `ANDROID_SERIAL` o'zgaruvchisiga keraklisining serial'ini bering.

## Ishlab chiqish

`scripts/test.sh` barcha tekshiruvlarni ishga tushiradi: marketplace va mod uchun `claude plugin validate`, mod testlari (`claude plugin test mod`), receiver testlari (`node --test`, Tally'ning Home ekranidan olingan dump bilan), kutubxonaning unit testlari hamda Tally'ning debug va release build'lari.

## Litsenziya

MIT, [LICENSE](LICENSE) fayliga qarang.
