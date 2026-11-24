package app.dualui.pixel

import android.os.Build
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.dualui.core.data.ThemedIconColors
import app.dualui.shared.PlexArabicFamily
import app.dualui.shared.typographyOf

val PixelIconShape = androidx.compose.foundation.shape.CircleShape
val PixelCard = RoundedCornerShape(28.dp)

/** Themed (monochrome, wallpaper-tinted) icon colours when the user enables themed icons; null = normal icons. */
val LocalThemedIcons = compositionLocalOf<ThemedIconColors?> { null }

private val FallbackLight = lightColorScheme(
    primary = Color(0xFF0B57D0), onPrimary = Color.White, primaryContainer = Color(0xFFD3E3FD), onPrimaryContainer = Color(0xFF041E49),
    background = Color(0xFFF8F9FC), surface = Color(0xFFF8F9FC), onSurface = Color(0xFF1B1B1F), onSurfaceVariant = Color(0xFF44474E),
    surfaceContainer = Color(0xFFECEFF7), surfaceContainerHigh = Color(0xFFE6E9F1), surfaceContainerHighest = Color(0xFFDFE3EB),
    secondaryContainer = Color(0xFFDDE3EA),
)
private val FallbackDark = darkColorScheme(
    primary = Color(0xFFA8C7FA), onPrimary = Color(0xFF062E6F), primaryContainer = Color(0xFF0842A0), onPrimaryContainer = Color(0xFFD3E3FD),
    background = Color(0xFF111318), surface = Color(0xFF111318), onSurface = Color(0xFFE3E2E6), onSurfaceVariant = Color(0xFFC4C6D0),
    surfaceContainer = Color(0xFF1D2024), surfaceContainerHigh = Color(0xFF282A2F), surfaceContainerHighest = Color(0xFF33353A),
    secondaryContainer = Color(0xFF3D4759),
)

/** Material You: dynamic colours from the wallpaper on Android 12+, a Pixel-like blue palette otherwise. */
@Composable
fun PixelTheme(dark: Boolean, content: @Composable () -> Unit) {
    val ctx = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        dark -> FallbackDark
        else -> FallbackLight
    }
    MaterialTheme(
        colorScheme = scheme,
        typography = typographyOf(PlexArabicFamily),
        shapes = Shapes(small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(20.dp), large = RoundedCornerShape(28.dp)),
    ) { CompositionLocalProvider(content = content) }
}
