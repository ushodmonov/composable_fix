# ComposableFix

[English](README.md) | **O'zbekcha** | [Русский](README.ru.md)

Jetpack Compose ilovangizning debug build'idagi istalgan elementni bosib turing, nima noto'g'ri ekanini yozing va Return tugmasini bosing. Hisobot loyihangizda allaqachon ishlab turgan Claude Code sessiyasiga tushadi: element, uni belgilagan Kotlin kodi qatori, skrinshot va sizning so'zlaringiz. Claude kodni tuzatadi, ilovani qayta o'rnatib ishga tushiradi, ilovadagi banner esa tuzatishni navbatga tushganidan to ekranda paydo bo'lguncha kuzatib boradi.

![Android emulyatorida elementlarni bosib turish Claude Code'ga hisobot yuboradi: siljib qolgan tugma, yumaloqlanmagan burchaklar, kesilib qolgan ism va qizil rangdagi daromad summasi, har birini Claude tuzatadi va ilovani qayta o'rnatadi](docs/demo.gif)

[Demoni to'liq sifatda ko'ring (MP4, 72 s)](docs/demo.mp4). U Android emulyatorida jonli yozib olingan: plagin o'rnatilgan terminaldagi Claude Code sessiyasi hisobotlar asosida Tally'dagi ataylab qo'yilgan to'rtta xatoni tuzatdi. Faqat kutish joylari tezlashtirilgan.

ComposableFix — bu iOS simulyatoridagi SwiftUI ilovalari uchun xuddi shu ishni bajaradigan [FixKit](https://github.com/ostiums/fixkit) loyihasining Jetpack Compose'ga ko'chirilgan versiyasi. Flutter ilovalari uchun [WidgetFix](https://github.com/ushodmonov/widget_fix) loyihasiga qarang.

ComposableFix ikki qismdan iborat:

- Claude Code uchun **composablefix plagini** hisobotlarni terminalda ham, VS Code extension'da ham qabul qiladi: uning MCP serveri receiver'ni ishga tushiradi, command hook'lari har bir hisobotni kuzatib boradi, mod'i esa har bir hisobotni kelishi bilan prompt qilib yuboradi;
- **ComposableFix Android kutubxonasi** ularni debug build'dan yuboradi. Release build'lar uning o'rniga hech narsa qilmaydigan `composablefix-noop` kutubxonasiga bog'lanadi.

## Talablar

- Claude Code 2.1.287 yoki undan yangisi.
- Node.js 18.2 yoki undan yangisi; plaginning receiver'i va hook'lari shunda ishlaydi.
- Jetpack Compose 1.10 yoki undan yangisi, skrinshotlar uchun esa Android 8.0 (API 26) yoki undan yangisi. Kutubxona API 23 dan boshlab build bo'ladi; u yerda skrinshotni o'zi chizadi.
- Android emulyatori yoki USB yoxud wireless debugging orqali ulangan qurilma.
- Android SDK platform-tools tarkibidagi adb. U hisobotdagi bosish qaysi elementga tushganini aniqlaydi va qurilmaga Mac'ga ulanish imkonini beradi. Plagin uni avval `COMPOSABLEFIX_ADB` dan, so'ng `ANDROID_HOME` va `ANDROID_SDK_ROOT` dan, keyin `PATH` dan, oxirida `~/Library/Android/sdk` dan qidiradi. adb bo'lmasa ham emulyatordan hisobotlar skrinshot va bosilgan nuqta bilan kelaveradi.

## O'rnatish

### 1. Plagin

```bash
claude plugin marketplace add ushodmonov/composable_fix
claude plugin install composablefix@composablefix
```

Shundan so'ng plagin har bir Claude Code sessiyasida, terminalda ham, VS Code extension'da ham yuklanadi. Hisobotlarni faqat ComposableFix ishlatadigan loyihada yoki undan ikki daraja yuqoridagi papkada ochilgan sessiya oladi: uning MCP serveri receiver'ni sessiya bilan birga ishga tushiradi va sessiya tugaganda to'xtatadi. Boshqa papkalardagi sessiyalar hisobotlarga tegmaydi; [Bir nechta loyiha](#bir-nechta-loyiha) bo'limiga qarang. WidgetFix mod'i ham xuddi shu 4747-portdan foydalanadi, shuning uchun ikkalasidan bittasini yoqing.

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

Plagin hisobotlarni Gradle loyihasining ildizidagi, ya'ni `settings.gradle.kts` turgan papkadagi `.composablefix/` papkasiga yozadi; `.composablefix/` ni `.gitignore` fayliga qo'shing. `claude` ni shu papkada yoki undan ikki daraja yuqoridagi papkada ishga tushiring, masalan, ilova `android/` ichida turgan repozitoriyda: plagin pastdagi eng yaqin loyihani topadi va Claude'ga barcha yo'llarni sessiya papkasidan boshlab beradi (`android/.composablefix/reports/r1.png`). VS Code'da extension sessiyasi VS Code ochib turgan papkada ishlaydi. Claude skrinshotlarni har safar ruxsat so'ramasdan ochishi uchun loyihaning Claude Code sozlamalarida bunga ruxsat bering:

```json
{ "permissions": { "allow": ["Read(./.composablefix/**)"] } }
```

Loyihadan yuqoridagi sessiyada yo'lga loyiha papkasi qo'shiladi: `Read(./android/.composablefix/**)`. Gradle install va `adb` buyruqlarini ham ruxsat ro'yxatiga qo'shmasangiz, Claude ularni ishga tushirishdan oldin so'raydi.

## Nega `ComposableFixHost` ildizni o'raydi

Bu composable ishga tushmaguncha kutubxona hech narsa qilmaydi. U beshta ishni bajaradi:

- **Bosib turish.** U har bir bosishni ilovaning o'z gesture'laridan oldin, Compose'ning initial pass bosqichida kuzatadi. Tugmalar, ro'yxatlar va pager'lar ishlashda davom etadi. Bosish yarim soniya qimirlamay tursa, u ComposableFix'ga o'tadi: qolgan qismi iste'mol qilinadi (consume), shu bois barmoq ostidagi tugma bunga javob bermaydi.
- **Izoh oynasi.** U xiralashtirilgan ekranni chizadi: bosilgan element yoritilgan, izoh maydoni esa klaviatura ustida turadi. Agar klaviatura elementni yopib qo'yadigan bo'lsa, u ilovani yuqoriga suradi. Back tugmasi uni yopadi.
- **Banner'lar.** U ekranning yuqori qismida hisobot jarayonini ko'rsatadi: yuborildi, navbatda, tuzatilmoqda, qayta build qilinmoqda, tuzatildi.
- **Ishga tushish signali.** Jarayon boshlanganda u receiver'ga ilova ishga tushganini xabar qiladi. Claude hisobot ustida ishlayotgan paytdagi ishga tushish plaginga tuzatish ekranga chiqqanini bildiradi: Claude ilovani Gradle orqali o'rnatganmi yoki Android Studio'da Run tugmasini o'zingiz bosganmisiz, farqi yo'q. Qayta ishga tushgach, ilova hisobot jarayonini yana kuzatishda davom etadi. Ekran burilishi yoki qurilma buklanishi sababli qayta yaratilgan activity ishga tushish hisoblanmaydi.
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
2. Loyiha papkasida `claude` ni ishga tushiring yoki papkani VS Code'da ochib, u yerda Claude Code suhbatini boshlang. Terminalda Fix queue paneli kengligi 144 ustun yoki undan katta terminalda ochiladi; `/fix-queue` uni istalgan kenglikda ochadi. Agar shu loyihaning boshqa sessiyasi hisobotlarni allaqachon olayotgan bo'lsa, bu sessiya kutish holatida turadi va buni aytadi; `/fix-take` yoki Claude'dan hisobotlarni olishni so'rash (`take_reports` tool'i) ularni shu sessiyaga ko'chiradi.
3. Ilovadagi elementni bosib turing, nima noto'g'ri ekanini yozing va Return tugmasini bosing. Back tugmasi yoki xiralashgan ekranga bosish izoh oynasini yopadi.

Har bir hisobot terminalda ham, VS Code extension'da ham alohida prompt bo'lib keladi. Agar host plaginning mod'ini ishga tushirmasa, hisobot keyingi xabaringiz bilan keladi; Claude'dan fix hisobotlarini kuzatishni so'rasangiz, u har birini kutib turadi (`wait_for_report` tool'i).

Panel va ilovadagi banner `queued`, `fixing`, `rebuilding` va `live` holatlaridan o'tadi. Gradle install task'i yoki `adb install` ishlayotganda hisobot rebuilding holatida ko'rinadi. Claude hisobot ustida ishlayotganda ilova qayta ishga tushsa, hisobot live holatiga o'tadi va Claude ishni javob bilan yakunlasa ham live bo'lib qoladi. Claude bitta hisobot ustida ishlayotganda yuborilgan hisobotlar navbatda kutib turadi.

## Qurilmalar

Ilova receiver'ni avval o'z qurilmasidagi `127.0.0.1:4747` manzilidan, so'ng `10.0.2.2:4747` manzilidan qidiradi: emulyator o'zi ishlayotgan kompyuterni shu manzil bilan ataydi.

| Ilova qayerda ishlaydi | Unga nima kerak |
| --- | --- |
| Android emulyatori | hech narsa |
| USB yoki wireless debugging orqali ulangan qurilma | hech narsa: receiver adb ko'radigan har bir qurilma uchun `adb reverse tcp:4747 tcp:4747` ni o'rnatib turadi |

Receiver portni faqat adb server ishlab turgan bo'lsa ulaydi va uni hech qachon o'zi ishga tushirmaydi. Bir nechta qurilma bo'lsa, hisobotni qaysi biri yuborganini ilova jarayonining id'si (pid) orqali aniqlaydi.

## Bir nechta loyiha

Hisobotlar ilova loyihasida ochilgan sessiyaga boradi, shuning uchun bir vaqtda bir nechta loyiha ochiq bo'lishi mumkin: har birining o'z ilovasi va o'z Claude Code sessiyasi bo'ladi. Ilova hamma narsani `127.0.0.1:4747` manziliga yuboradi. Birinchi receiver shu portni egallaydi va hub bo'ladi; har bir receiver, jumladan hub'ning o'zi ham, yana o'z portida tinglaydi va hub'da o'z loyihasi bilan ro'yxatdan o'tadi. Hub har bir so'rovda loyihalardan ilova ularnikimi, deb so'raydi: loyihaning Gradle fayllarida ilovaning application id'si (`.debug` kabi qo'shimcha bilan yoki usiz) yoki namespace'i e'lon qilinganmi, yoxud manba kodi ilova paketida joylashganmi. Natijada:

- ComposableFix loyihasi bo'lmagan papkadagi sessiya receiver ishga tushirmaydi va o'zidan keyin `.composablefix/` papkasini qoldirmaydi;
- bitta loyihaning ikki sessiyasidan hisobotlarni birinchisi saqlab qoladi, shuning uchun yon savol uchun ochilgan ikkinchi `claude` ularni ilib ketmaydi; ikkinchisidagi `/fix-take` yoki uning `take_reports` tool'i ularni o'sha yerga ko'chiradi;
- hub'ning sessiyasi tugaganda, bir necha soniya ichida boshqa sessiyaning receiver'i portni egallaydi.

Hech bir ochiq sessiya o'ziniki deb bilmagan ilova javob olmaydi va uning banneri Claude Code tinglamayotganini aytadi.

## Qanday ishlaydi

```
app (ComposableFix) ──POST /report?app=…──▶ hub: 127.0.0.1:4747, one session's receiver
        ▲                                          │ to the session of the app's project
        │ POST /launched,                          ▼
        │ GET /status                  receiver: the plugin's MCP server ──adb uiautomator dump──▶ device
        └──────────────────────────────────────────┤  ▲ prompt, install, turn end: command hooks
                                                   │  │ list, wait, take, set status: MCP tools
                                                   ▼
                                 the mod: each report as a prompt, the Fix queue pane
```

Receiver plaginning MCP serverida ishlaydi; Claude Code uni har bir sessiya bilan, terminalda ham, VS Code extension'da ham ishga tushiradi. Ilova hisobotni izoh oynasi yopilgandan keyin yuboradi, receiver esa javob berishdan oldin ekranning accessibility daraxtini o'qiydi; shu paytgacha ilova yangi bosib turishni qabul qilmaydi. Receiver bosilgan nuqta ostidagi eng chuqur nomlangan elementni va o'sha qatordagi yonidagi yozuvlarni tanlaydi, skrinshotni va butun daraxtni `.composablefix/reports/` ga saqlaydi hamda qurilmani va belgilangan elementning manba faylini topadi.

Mod har bir hisobotni prompt qilib yuboradi; host uni ishga tushirmasa, `UserPromptSubmit` hook'i kutib turgan hisobotlarni keyingi xabarga qo'shadi. Receiver har bir hisobotning holatini saqlaydi, ilova esa uni muntazam so'rab turadi: hisobotni olib kelgan prompt uni `fixing` qiladi, o'sha sessiyadagi Gradle install yoki `adb install` (`PreToolUse` hook'i) `rebuilding`, ilovaning ishga tushishi `live`, ishga tushishsiz tugagan navbat (`Stop` hook'i) esa `stopped` qiladi. MCP server Claude'ga `[fix …]` qatori bo'yicha ko'rsatmalarni va tool'larini ham beradi: `list_reports`, `get_report`, `wait_for_report`, `take_reports` va `set_status`.

`COMPOSABLEFIX_PORT` hub portini o'zgartiradi, lekin ilova doim 4747-portga yuboradi.

## Misol: Tally

`android/tally/` — asl FixKit'dagi SwiftUI hamyon ilovasining Jetpack Compose versiyasi. Unda xuddi o'sha to'rtta ataylab qo'yilgan UI xatosi bor va u ushbu repozitoriydagi kutubxonaga bog'langan.

```bash
git clone https://github.com/ushodmonov/composable_fix && cd composable_fix
./scripts/reset-demo.sh          # puts the bugs back, builds, installs and launches Tally
claude --plugin-dir ./mod        # the plugin from this checkout
```

`--plugin-dir` qabul qilmaydigan VS Code'da checkout'ni marketplace sifatida qo'shing va undan o'rnating: `claude plugin marketplace add .` va `claude plugin install composablefix@composablefix`. Shunda plagin to'g'ridan-to'g'ri papkadan o'qiladi va `/reload-plugins` o'zgarishlarni oladi.

| Qayerda | Nimani bosib turish kerak | Ishlaydigan izoh |
| --- | --- | --- |
| Home | Send tugmasi | button is shifted |
| Home | Top up tugmasi | corners don't match the others |
| Home yoki Cards | karta egasining ismi | name is cut off |
| Home yoki Activity | yashil kategoriyadagi summa, masalan, maosh | income should be green |

Har biri koddagi bir qatorlik kichik xato. Reset skripti ularni `demo-start` git tag'idan, ya'ni xatolar qo'yilgan commit'dan tiklaydi. U ilovani adb ko'rib turgan qurilmaga o'rnatadi; bir nechta qurilma bo'lsa, `ANDROID_SERIAL` o'zgaruvchisiga keraklisining serial'ini bering.

## Ishlab chiqish

`scripts/test.sh` barcha tekshiruvlarni ishga tushiradi: marketplace va plagin uchun `claude plugin validate`, mod testlari (`claude plugin test mod`), receiver testlari (`node --test`: Tally'ning Home ekranidan olingan dump bo'yicha qidiruv, hub'ning yo'naltirishi, sessiyadagi hisobotning queued'dan live'gacha yo'li, command hook'lar va MCP server), kutubxonaning unit testlari hamda Tally'ning debug va release build'lari.

## Litsenziya

MIT, [LICENSE](LICENSE) fayliga qarang.
