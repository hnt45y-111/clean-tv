package app.dualui.samsung

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.data.ArabicFormat
import app.dualui.core.engine.SkinHost
import app.dualui.shared.*
import app.dualui.shared.R as SharedR
import kotlin.math.abs

@Composable
fun SamsungHome(host: SkinHost) {
    val vm = host.vm
    val dark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val ws = rememberWorkspaceState(vm)
    val drawer = rememberReveal()
    val panel = rememberReveal()
    var showWidgets by remember { mutableStateOf(false) }
    var showEdit by remember { mutableStateOf(false) }
    val tone by vm.services.wallpaper.tone.collectAsState()
    val ink = if (tone.supportsDarkText) Color(0xFF111111) else Color.White
    val screenH = with(LocalDensity.current) { LocalConfiguration.current.screenHeightDp.dp.toPx() }
    var gesture by remember { mutableIntStateOf(0) }   // 1 = drawer, 2 = quick panel

    val cs = MaterialTheme.colorScheme
    val spec = remember(ink, dark) {
        WorkspaceSpec(
            headerRows = 2,
            pageHeader = { SamsungClockHeader(ink) },
            cell = { m, size, label -> SamsungCell(m, size, label, ink) },
            widgetShape = RoundedCornerShape(26.dp),
            dockContainer = { content -> SamsungDock(content) },
            aboveDock = { pager -> SamsungPageIndicator(pager, ws.pageCount, ink) },
            pageGraphics = { off -> samsungPageGraphics(this, off) },
            menu = { m, dismiss -> SamsungMenu(m.anchor, m.actions, dismiss) },
            folder = FolderStyle(RoundedCornerShape(34.dp), cs.surface.copy(alpha = 0.94f), cs.onSurface, Color.Black.copy(alpha = 0.40f), TajawalFamily, columns = 3, startScale = 0.55f),
            dropBar = DropBarStyle(Color.Black.copy(alpha = 0.45f), Color.White, cs.primary, Color.White, RoundedCornerShape(28.dp), TajawalFamily),
            dropHint = Color.White,
        )
    }

    LaunchedEffect(Unit) {
        vm.homePressed.collect {
            drawer.close(); panel.close(); showWidgets = false; showEdit = false
            ws.openFolder = null; ws.menu = null
            ws.pager.animateScrollToPage(0)
        }
    }
    BackHandler(enabled = drawer.visible || panel.visible || showWidgets || showEdit) {
        when {
            showWidgets -> showWidgets = false
            showEdit -> showEdit = false
            panel.visible -> panel.close()
            else -> drawer.close()
        }
    }
    // Home button / back from outside returns to first page (handled by activity via vm.currentPage reset)

    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier.fillMaxSize().graphicsLayer {
                val p = drawer.progress
                scaleX = 1f - 0.07f * p; scaleY = 1f - 0.07f * p; alpha = 1f - p * 0.9f
            },
        ) {
            HomeWorkspace(
                vm = vm, ws = ws, spec = spec,
                blocked = drawer.visible || panel.visible || showWidgets || showEdit,
                onVerticalDrag = { startY, dy ->
                    if (gesture == 0) gesture = if (dy > 0 && startY < screenH * 0.18f) 2 else 1
                    if (gesture == 1) drawer.drag(abs(dy) / (screenH * 0.5f))
                    else panel.drag(dy / (screenH * 0.55f))
                },
                onVerticalEnd = { dy, vy, cancelled ->
                    val g = gesture; gesture = 0
                    if (g == 1) drawer.settle(!cancelled && (drawer.progress > 0.3f || abs(vy) > 1200f))
                    if (g == 2) panel.settle(!cancelled && (panel.progress > 0.3f || vy > 1200f))
                },
                onBackgroundLongPress = { showEdit = true },
            )
        }
        SamsungDrawer(vm, drawer, dark)
        SamsungControlCenter(host, panel, dark)
        if (showEdit) SamsungEditSheet(
            onDismiss = { showEdit = false },
            onWallpaper = { showEdit = false; host.openSettings("wallpaper") },
            onWidgets = { showEdit = false; showWidgets = true },
            onSettings = { showEdit = false; host.openSettings(null) },
        )
        if (showWidgets) WidgetPicker(
            vm, SheetStyle(cs.surface, cs.onSurface, cs.onSurfaceVariant, cs.primary, cs.surfaceVariant.copy(alpha = 0.5f),
                RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp), TajawalFamily),
            onDismiss = { showWidgets = false },
        )
    }
}

@Composable
fun SamsungClockHeader(ink: Color) {
    val now by rememberNow()
    Column(Modifier.fillMaxSize().padding(horizontal = 28.dp), verticalArrangement = Arrangement.Center) {
        Text(ArabicFormat.time(now.toLocalTime()), color = ink, fontSize = 74.sp, fontWeight = FontWeight.Normal, lineHeight = 78.sp)
        Text(ArabicFormat.date(now.toLocalDate()), color = ink.copy(alpha = 0.9f), fontSize = 16.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun SamsungEditSheet(onDismiss: () -> Unit, onWallpaper: () -> Unit, onWidgets: () -> Unit, onSettings: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f))
        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss)) {
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)).background(cs.surface)
                .navigationBarsPadding().padding(20.dp)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {},
        ) {
            Text(stringResource(R.string.sm_edit_title), color = cs.onSurface, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                EditTile(Icons.Rounded.Wallpaper, stringResource(SharedR.string.home_menu_wallpaper), Modifier.weight(1f), onWallpaper)
                EditTile(Icons.Rounded.Widgets, stringResource(SharedR.string.home_menu_widgets), Modifier.weight(1f), onWidgets)
                EditTile(Icons.Rounded.Settings, stringResource(R.string.sm_settings_short), Modifier.weight(1f), onSettings)
            }
        }
    }
}

@Composable
private fun EditTile(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Column(
        modifier.clip(RoundedCornerShape(24.dp)).background(cs.surfaceVariant).clickable(onClick = onClick).padding(vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, tint = cs.primary, modifier = Modifier.size(30.dp))
        Spacer(Modifier.height(8.dp))
        Text(label, color = cs.onSurface, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}
