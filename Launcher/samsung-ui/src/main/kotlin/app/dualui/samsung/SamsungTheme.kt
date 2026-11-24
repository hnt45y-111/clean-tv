package app.dualui.samsung

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.dualui.shared.TajawalFamily
import app.dualui.shared.typographyOf

object SamsungPalette {
    val Blue = Color(0xFF3E91FF)
    val BlueDark = Color(0xFF5BA3FF)
    val LightBg = Color(0xFFF6F6F8)
    val LightSurface = Color(0xFFFFFFFF)
    val LightTile = Color(0xFFE9EAEF)
    val DarkBg = Color(0xFF000000)
    val DarkSurface = Color(0xFF1C1C1F)
    val DarkTile = Color(0xFF2B2B30)
}

val SamsungIconShape = RoundedCornerShape(percent = 32)
val SamsungCard = RoundedCornerShape(26.dp)

/** Colour used for labels / header text drawn directly over the wallpaper. */
val LocalHomeInk = compositionLocalOf { Color.White }

@Composable
fun SamsungTheme(dark: Boolean, content: @Composable () -> Unit) {
    val scheme = if (dark) darkColorScheme(
        primary = SamsungPalette.BlueDark, onPrimary = Color.White, background = SamsungPalette.DarkBg,
        surface = SamsungPalette.DarkSurface, onSurface = Color(0xFFF2F2F5), surfaceVariant = SamsungPalette.DarkTile,
        onSurfaceVariant = Color(0xFFB4B4BC), secondaryContainer = SamsungPalette.DarkTile,
    ) else lightColorScheme(
        primary = SamsungPalette.Blue, onPrimary = Color.White, background = SamsungPalette.LightBg,
        surface = SamsungPalette.LightSurface, onSurface = Color(0xFF17171A), surfaceVariant = SamsungPalette.LightTile,
        onSurfaceVariant = Color(0xFF5E5E66), secondaryContainer = SamsungPalette.LightTile,
    )
    MaterialTheme(
        colorScheme = scheme,
        typography = typographyOf(TajawalFamily),
        shapes = Shapes(small = RoundedCornerShape(14.dp), medium = RoundedCornerShape(22.dp), large = RoundedCornerShape(28.dp)),
    ) { CompositionLocalProvider(content = content) }
}
