package app.dualui.shared

import app.dualui.core.engine.Reveal
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Typography
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDateTime

/** Minute-aligned clock for header widgets. */
@Composable
fun rememberNow(): State<LocalDateTime> {
    val now = remember { mutableStateOf(LocalDateTime.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            now.value = LocalDateTime.now()
            delay((60_000L - (System.currentTimeMillis() % 60_000L)).coerceAtLeast(500))
        }
    }
    return now
}

@Composable
fun rememberReveal(): Reveal {
    val scope = rememberCoroutineScope()
    return remember { Reveal(scope) }
}

/** Slider that works in RTL (fills from the right). Used by both control centres with different looks. */
@Composable
fun SliderBar(
    value: Float,
    onChange: (Float) -> Unit,
    icon: ImageVector,
    height: Dp,
    track: Color,
    fill: Color,
    iconTint: Color,
    shape: Shape = RoundedCornerShape(height / 2),
    thumb: Color? = null,
    modifier: Modifier = Modifier,
) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    var widthPx by remember { mutableFloatStateOf(1f) }
    fun frac(x: Float) = (if (rtl) 1f - x / widthPx else x / widthPx).coerceIn(0f, 1f)
    Box(
        modifier.fillMaxWidth().height(height).clip(shape).background(track)
            .pointerInput(rtl) { detectTapGestures { onChange(frac(it.x)) } }
            .pointerInput(rtl) { detectHorizontalDragGestures { change, _ -> change.consume(); onChange(frac(change.position.x)) } }
            .onSizeChanged { widthPx = it.width.toFloat().coerceAtLeast(1f) },
    ) {
        Box(Modifier.fillMaxHeight().fillMaxWidth(value.coerceIn(0.04f, 1f)).align(Alignment.CenterStart).background(fill))
        Icon(icon, null, tint = iconTint, modifier = Modifier.align(Alignment.CenterStart).padding(start = 14.dp).size(22.dp))
        if (thumb != null) {
            Box(
                Modifier.align(Alignment.CenterStart).fillMaxWidth(value.coerceIn(0.04f, 1f)).fillMaxHeight(),
                contentAlignment = Alignment.CenterEnd,
            ) { Box(Modifier.padding(horizontal = 4.dp).size(height - 12.dp).clip(RoundedCornerShape(50)).background(thumb)) }
        }
    }
}


/** Material typography with the skin's Arabic font applied to every style. */
fun typographyOf(font: FontFamily): Typography {
    val d = Typography()
    return Typography(
        displayLarge = d.displayLarge.copy(fontFamily = font), displayMedium = d.displayMedium.copy(fontFamily = font),
        displaySmall = d.displaySmall.copy(fontFamily = font), headlineLarge = d.headlineLarge.copy(fontFamily = font),
        headlineMedium = d.headlineMedium.copy(fontFamily = font), headlineSmall = d.headlineSmall.copy(fontFamily = font),
        titleLarge = d.titleLarge.copy(fontFamily = font), titleMedium = d.titleMedium.copy(fontFamily = font),
        titleSmall = d.titleSmall.copy(fontFamily = font), bodyLarge = d.bodyLarge.copy(fontFamily = font),
        bodyMedium = d.bodyMedium.copy(fontFamily = font), bodySmall = d.bodySmall.copy(fontFamily = font),
        labelLarge = d.labelLarge.copy(fontFamily = font), labelMedium = d.labelMedium.copy(fontFamily = font),
        labelSmall = d.labelSmall.copy(fontFamily = font),
    )
}
