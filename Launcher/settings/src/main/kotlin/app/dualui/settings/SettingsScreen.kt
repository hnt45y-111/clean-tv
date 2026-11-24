package app.dualui.settings

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import app.dualui.core.data.ArabicFormat
import app.dualui.core.data.WallpaperPreset
import app.dualui.core.engine.LauncherViewModel
import app.dualui.core.model.ThemeMode
import app.dualui.notifications.NotificationAccess
import kotlinx.coroutines.launch

/** Name/id pair for the interface switcher (the app passes every registered skin). */
data class SkinChoice(val id: String, val nameRes: Int)

private val sectionIndex = mapOf("interface" to 0, "wallpaper" to 4)

@Composable
fun SettingsScreen(
    vm: LauncherViewModel,
    skins: List<SkinChoice>,
    versionName: String,
    section: String?,
    onBack: () -> Unit,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs by vm.prefs.collectAsState()
    val p = prefs ?: return
    val cs = MaterialTheme.colorScheme
    val state = rememberLazyListState()
    BackHandler(onBack = onBack)
    LaunchedEffect(section) { sectionIndex[section]?.let { state.scrollToItem(it + 1) } }

    // re-evaluate "is default launcher / notification access" whenever we come back from system settings
    var tick by remember { mutableIntStateOf(0) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val o = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) tick++ }
        owner.lifecycle.addObserver(o); onDispose { owner.lifecycle.removeObserver(o) }
    }
    val isDefault = remember(tick) { isDefaultHome(ctx) }
    val notifOn = remember(tick) { NotificationAccess.isEnabled(ctx) }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) scope.launch {
            val ok = vm.services.wallpaper.setFromUri(uri)
            android.widget.Toast.makeText(ctx, if (ok) R.string.wp_applied_st else R.string.wp_failed_st, android.widget.Toast.LENGTH_SHORT).show()
        }
    }
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { tick++ }

    Column(Modifier.fillMaxSize().background(cs.background).windowInsetsPadding(WindowInsets.systemBars)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Rounded.ArrowForward, stringResource(R.string.st_back), tint = cs.onSurface)
            }
            Text(stringResource(R.string.st_title), color = cs.onSurface, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 6.dp))
        }
        LazyColumn(state = state, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                Section(stringResource(R.string.st_sec_interface)) {
                    Hint(stringResource(R.string.st_interface_hint))
                    Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        skins.forEach { s ->
                            val sel = p.skinId == s.id
                            Box(
                                Modifier.weight(1f).height(56.dp).clip(RoundedCornerShape(18.dp))
                                    .background(if (sel) cs.primary else cs.surfaceVariant)
                                    .clickable { vm.setSkin(s.id) },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(stringResource(s.nameRes), color = if (sel) cs.onPrimary else cs.onSurface, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
            item {
                Section(stringResource(R.string.st_sec_appearance)) {
                    Segmented(
                        listOf(ThemeMode.SYSTEM to R.string.st_theme_system, ThemeMode.LIGHT to R.string.st_theme_light, ThemeMode.DARK to R.string.st_theme_dark),
                        p.themeMode,
                    ) { vm.setThemeMode(it) }
                }
            }
            item {
                Section(stringResource(R.string.st_sec_home)) {
                    Label(stringResource(R.string.st_columns))
                    Segmented((4..6).map { it to null }, p.cols, labelOf = { ArabicFormat.number(it) }) { vm.setGrid(it, p.rows) }
                    Label(stringResource(R.string.st_rows))
                    Segmented((5..8).map { it to null }, p.rows, labelOf = { ArabicFormat.number(it) }) { vm.setGrid(p.cols, it) }
                    Label(stringResource(R.string.st_dock))
                    Segmented((3..6).map { it to null }, p.dockCount, labelOf = { ArabicFormat.number(it) }) { vm.setDock(it) }
                    Label(stringResource(R.string.st_icon_size))
                    Slider(value = p.iconScale, onValueChange = { vm.setIconScale(it) }, valueRange = 0.8f..1.3f)
                    SwitchRow(stringResource(R.string.st_labels), p.showLabels) { vm.setLabels(it) }
                    SwitchRow(stringResource(R.string.st_themed), p.themedIcons) { vm.setThemedIcons(it) }
                    Hint(stringResource(R.string.st_themed_hint))
                }
            }
            item {
                Section(stringResource(R.string.st_sec_wallpaper)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        WallpaperPreset.entries.forEach { w ->
                            Box(
                                Modifier.weight(1f).aspectRatio(0.62f).clip(RoundedCornerShape(14.dp))
                                    .background(Brush.verticalGradient(listOf(Color(w.top), Color(w.bottom))))
                                    .clickable {
                                        scope.launch {
                                            val ok = vm.services.wallpaper.setPreset(w)
                                            android.widget.Toast.makeText(ctx, if (ok) R.string.wp_applied_st else R.string.wp_failed_st, android.widget.Toast.LENGTH_SHORT).show()
                                        }
                                    },
                            )
                        }
                    }
                    ActionRow(Icons.Rounded.PhotoLibrary, stringResource(R.string.st_wp_gallery)) { pickImage.launch("image/*") }
                    ActionRow(Icons.Rounded.Wallpaper, stringResource(R.string.st_wp_system)) {
                        try { ctx.startActivity(vm.services.wallpaper.systemChooser()) } catch (_: Exception) {}
                    }
                }
            }
            item {
                Section(stringResource(R.string.st_sec_notifications)) {
                    StatusLine(notifOn, stringResource(if (notifOn) R.string.st_notif_on else R.string.st_notif_off))
                    ActionRow(Icons.Rounded.Notifications, stringResource(R.string.st_notif_button)) { ctx.startActivity(NotificationAccess.settingsIntent()) }
                }
            }
            item {
                Section(stringResource(R.string.st_sec_default)) {
                    StatusLine(isDefault, stringResource(if (isDefault) R.string.st_default_yes else R.string.st_default_no))
                    if (!isDefault) ActionRow(Icons.Rounded.Home, stringResource(R.string.st_default_button)) { requestHome(ctx) { roleLauncher.launch(it) } }
                }
            }
            item {
                Section(stringResource(R.string.st_sec_permissions)) {
                    listOf(R.string.st_perm_notif, R.string.st_perm_write, R.string.st_perm_dnd, R.string.st_perm_widgets, R.string.st_perm_wallpaper, R.string.st_perm_none)
                        .forEach { Hint(stringResource(it), Modifier.padding(vertical = 4.dp)) }
                }
            }
            item {
                Section(stringResource(R.string.st_sec_limits)) {
                    listOf(R.string.st_limit_1, R.string.st_limit_2, R.string.st_limit_3, R.string.st_limit_4)
                        .forEach { Hint("• " + stringResource(it), Modifier.padding(vertical = 4.dp)) }
                }
            }
            item {
                Text(stringResource(R.string.st_about, versionName), color = cs.onSurfaceVariant, fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
    }
}

fun isDefaultHome(ctx: Context): Boolean =
    if (Build.VERSION.SDK_INT >= 29) (ctx.getSystemService(Context.ROLE_SERVICE) as RoleManager).isRoleHeld(RoleManager.ROLE_HOME)
    else ctx.packageManager.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)?.activityInfo?.packageName == ctx.packageName

/** Asks the system to make this app the HOME app (Android shows its own confirmation). */
fun requestHome(ctx: Context, launch: (Intent) -> Unit) {
    val i = if (Build.VERSION.SDK_INT >= 29) {
        val rm = ctx.getSystemService(Context.ROLE_SERVICE) as RoleManager
        if (rm.isRoleAvailable(RoleManager.ROLE_HOME)) rm.createRequestRoleIntent(RoleManager.ROLE_HOME) else Intent(Settings.ACTION_HOME_SETTINGS)
    } else Intent(Settings.ACTION_HOME_SETTINGS)
    launch(i)
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    val cs = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(26.dp)).background(cs.surface).padding(18.dp)) {
        Text(title, color = cs.primary, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))
        content()
    }
}

@Composable private fun Hint(text: String, modifier: Modifier = Modifier) =
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.5.sp, lineHeight = 19.sp, modifier = modifier)

@Composable private fun Label(text: String) =
    Text(text, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))

@Composable
private fun <T> Segmented(options: List<Pair<T, Int?>>, selected: T, labelOf: @Composable (T) -> String = { "" }, onSelect: (T) -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(cs.surfaceVariant).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (value, res) ->
            val sel = value == selected
            Box(
                Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(12.dp)).background(if (sel) cs.primary else Color.Transparent).clickable { onSelect(value) },
                contentAlignment = Alignment.Center,
            ) {
                Text(if (res != null) stringResource(res) else labelOf(value), color = if (sel) cs.onPrimary else cs.onSurface, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp, modifier = Modifier.weight(1f))
        Switch(checked, onChange)
    }
}

@Composable
private fun ActionRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(16.dp)).background(cs.surfaceVariant).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = cs.primary)
        Spacer(Modifier.width(12.dp))
        Text(label, color = cs.onSurface, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun StatusLine(ok: Boolean, text: String) {
    val cs = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(if (ok) Icons.Rounded.CheckCircle else Icons.Rounded.Info, null, tint = if (ok) Color(0xFF2E9E5B) else cs.onSurfaceVariant)
        Spacer(Modifier.width(10.dp))
        Text(text, color = cs.onSurface, fontSize = 14.sp)
    }
}
