package app.dualui.pixel

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.data.ArabicFormat
import app.dualui.core.engine.SkinHost
import app.dualui.shared.*
import app.dualui.shared.R as SharedR
import kotlin.math.abs

@Composable
fun PixelHome(host: SkinHost) {
    val vm = host.vm
    val ctx = LocalContext.current
    val cs = MaterialTheme.colorScheme
    val prefs by vm.prefs.collectAsState()
    val ws = rememberWorkspaceState(vm)
    val drawer = rememberReveal()
    val panel = rememberReveal()
    var showWidgets by remember { mutableStateOf(false) }
    var editAnchor by remember { mutableStateOf<Offset?>(null) }
    var focusSearch by remember { mutableStateOf(false) }
    val tone by vm.services.wallpaper.tone.collectAsState()
    val ink = if (tone.supportsDarkText) Color(0xFF14161A) else Color.White
    val screenH = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    var gesture by remember { mutableIntStateOf(0) }
    val themed = if (prefs?.themedIcons == true) themedColors(cs.primaryContainer, cs.onPrimaryContainer) else null

    val spec = remember(ink, cs) {
        WorkspaceSpec(
            headerRows = 1,
            pageHeader = { PixelAtAGlance(ink, host) },
            cell = { m, size, label -> PixelCell(m, size, label, ink) },
            widgetShape = RoundedCornerShape(28.dp),
            dockContainer = { content -> Box(Modifier.padding(horizontal = 10.dp)) { content() } },
            aboveDock = { pager ->
                Column {
                    PixelPageIndicator(pager, ws.pageCount, ink)
                    PixelSearchPill { focusSearch = true; drawer.open() }
                }
            },
            pageGraphics = { off -> pixelPageGraphics(this, off) },
            menu = { m, dismiss -> PixelMenu(m.anchor, m.actions, dismiss) },
            folder = FolderStyle(RoundedCornerShape(36.dp), cs.surfaceContainerHigh, cs.onSurface, Color.Black.copy(alpha = 0.35f), PlexArabicFamily, columns = 3, startScale = 0.35f),
            dropBar = DropBarStyle(cs.surfaceContainerHigh, cs.onSurface, cs.primary, cs.onPrimary, RoundedCornerShape(28.dp), PlexArabicFamily),
            dropHint = cs.primary,
            dockHeightRows = 0.95f,
        )
    }

    LaunchedEffect(Unit) {
        vm.homePressed.collect {
            drawer.close(); panel.close(); showWidgets = false; editAnchor = null
            ws.openFolder = null; ws.menu = null
            ws.pager.animateScrollToPage(0)
        }
    }
    BackHandler(enabled = drawer.visible || panel.visible || showWidgets || editAnchor != null) {
        when {
            showWidgets -> showWidgets = false
            editAnchor != null -> editAnchor = null
            panel.visible -> panel.close()
            else -> drawer.close()
        }
    }

    CompositionLocalProvider(LocalThemedIcons provides themed) {
        Box(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().graphicsLayer { val s = 1f - 0.04f * drawer.progress; scaleX = s; scaleY = s; alpha = 1f - 0.6f * drawer.progress }) {
                HomeWorkspace(
                    vm = vm, ws = ws, spec = spec,
                    blocked = drawer.visible || panel.visible || showWidgets || editAnchor != null,
                    onVerticalDrag = { startY, dy ->
                        if (gesture == 0) gesture = if (dy > 0) 2 else 1      // Pixel: swipe down = notifications, swipe up = apps
                        if (gesture == 1) drawer.drag(-dy / (screenH * 0.6f)) else panel.drag(dy / (screenH * 0.55f))
                    },
                    onVerticalEnd = { dy, vy, cancelled ->
                        val g = gesture; gesture = 0
                        if (g == 1) drawer.settle(!cancelled && (drawer.progress > 0.3f || -vy > 1200f))
                        if (g == 2) panel.settle(!cancelled && (panel.progress > 0.3f || vy > 1200f))
                    },
                    onBackgroundLongPress = { editAnchor = it },
                )
            }
            PixelDrawer(vm, drawer, focusSearch) { focusSearch = false }
            PixelControlCenter(host, panel)
            editAnchor?.let { at ->
                val r = Rect(at.x - 1f, at.y - 1f, at.x + 1f, at.y + 1f)
                PixelMenu(
                    r,
                    listOf(
                        MenuAction(ctx.getString(SharedR.string.home_menu_wallpaper), Icons.Rounded.Wallpaper) { host.openSettings("wallpaper") },
                        MenuAction(ctx.getString(SharedR.string.home_menu_widgets), Icons.Rounded.Widgets) { showWidgets = true },
                        MenuAction(ctx.getString(SharedR.string.home_menu_settings), Icons.Rounded.Settings) { host.openSettings(null) },
                    ),
                ) { editAnchor = null }
            }
            if (showWidgets) WidgetPicker(
                vm, SheetStyle(cs.surfaceContainer, cs.onSurface, cs.onSurfaceVariant, cs.primary, cs.surfaceContainerHigh,
                    RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp), PlexArabicFamily),
                onDismiss = { showWidgets = false },
            )
        }
    }
}

/** "At a glance": big date, then time + battery line. Pure launcher widget built from real device data. */
@Composable
fun PixelAtAGlance(ink: Color, host: SkinHost) {
    val now by rememberNow()
    val snap by host.vm.services.quickSettings.state.collectAsState()
    Column(Modifier.fillMaxSize().padding(horizontal = 26.dp), verticalArrangement = Arrangement.Center) {
        Text(ArabicFormat.date(now.toLocalDate()), color = ink, fontSize = 30.sp, fontWeight = FontWeight.Medium, lineHeight = 36.sp)
        Text(
            ArabicFormat.time(now.toLocalTime()) + " " + ArabicFormat.ampm(now.toLocalTime()) + "  •  " +
                (if (snap.charging) "⚡ " else "") + ArabicFormat.percent(snap.batteryPercent),
            color = ink.copy(alpha = 0.9f), fontSize = 15.sp,
        )
    }
}
