package app.dualui.shared

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import app.dualui.core.data.ThemedIconColors
import app.dualui.core.engine.LauncherServices
import app.dualui.core.model.AppInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Renders an installed app's real icon, masked to the skin's icon shape. */
@Composable
fun AppIcon(
    app: AppInfo,
    size: Dp,
    shape: Shape,
    modifier: Modifier = Modifier,
    themed: ThemedIconColors? = null,
) {
    val ctx = LocalContext.current
    val icons = remember { LauncherServices.get(ctx).icons }
    val px = with(LocalDensity.current) { size.roundToPx() }.coerceAtLeast(16)
    var bmp by remember(app.key, px, themed) { mutableStateOf<ImageBitmap?>(icons.cached(app, px, themed)) }
    LaunchedEffect(app.key, px, themed) {
        if (bmp == null) bmp = withContext(Dispatchers.Default) { icons.load(app, px, themed) }
    }
    Box(modifier.size(size).clip(shape).background(Color.Transparent)) {
        bmp?.let { Image(it, null, Modifier.size(size), contentScale = ContentScale.Crop) }
    }
}

fun themedColors(bg: Color, fg: Color) = ThemedIconColors(bg.toArgb(), fg.toArgb())
