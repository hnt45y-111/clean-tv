package app.dualui.shared

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Icon
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Brush
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

/** One system-app icon drawn by an interface's own icon set (original artwork, no vendor assets). */
class RoleStyle(val icon: androidx.compose.ui.graphics.vector.ImageVector, val colors: List<Color>, val fg: Color = Color.White)
class IconPack(val styles: Map<app.dualui.core.data.IconRole, RoleStyle>)
val LocalIconPack = androidx.compose.runtime.compositionLocalOf<IconPack?> { null }

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
    val services = remember { LauncherServices.get(ctx) }
    val icons = services.icons
    val pack = LocalIconPack.current
    val style = remember(pack, app.packageName) { pack?.let { p -> services.roles.roleByPackage[app.packageName]?.let { p.styles[it] } } }
    if (style != null) {
        Box(modifier.size(size).clip(shape).background(Brush.linearGradient(style.colors)), contentAlignment = Alignment.Center) {
            Icon(style.icon, null, tint = style.fg, modifier = Modifier.size(size * 0.56f))
        }
        return
    }
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
