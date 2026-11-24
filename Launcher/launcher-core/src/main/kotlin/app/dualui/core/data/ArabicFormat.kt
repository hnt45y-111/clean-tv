package app.dualui.core.data

import java.text.NumberFormat
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Arabic-first formatting: Arabic month/day names and Arabic-Indic digits. */
object ArabicFormat {
    val locale: Locale = Locale.forLanguageTag("ar-u-nu-arab")
    private val nf = NumberFormat.getInstance(locale)
    private val timeFmt = DateTimeFormatter.ofPattern("h:mm", locale)
    private val dateFmt = DateTimeFormatter.ofPattern("EEEE، d MMMM", locale)
    private val shortDateFmt = DateTimeFormatter.ofPattern("EEE d MMM", locale)
    private val ampmFmt = DateTimeFormatter.ofPattern("a", locale)

    fun number(n: Int): String = nf.format(n)
    fun time(t: LocalTime = LocalTime.now()): String = t.format(timeFmt)
    fun ampm(t: LocalTime = LocalTime.now()): String = t.format(ampmFmt)
    fun date(d: LocalDate = LocalDate.now()): String = d.format(dateFmt)
    fun shortDate(d: LocalDate = LocalDate.now()): String = d.format(shortDateFmt)
    fun percent(n: Int): String = nf.format(n) + "٪"
}
