package app.dualui.shared

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/** Samsung identity: Tajawal (geometric, friendly, close to One UI's rounded feel). */
val TajawalFamily = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
)

/** Pixel identity: IBM Plex Sans Arabic (neutral, clean, close to Google Sans proportions). */
val PlexArabicFamily = FontFamily(
    Font(R.font.ibmplexsansarabic_regular, FontWeight.Normal),
    Font(R.font.ibmplexsansarabic_medium, FontWeight.Medium),
    Font(R.font.ibmplexsansarabic_bold, FontWeight.Bold),
)
