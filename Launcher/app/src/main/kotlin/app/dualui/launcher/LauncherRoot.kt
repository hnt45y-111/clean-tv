package app.dualui.launcher

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.statusBarsIgnoringVisibility
import app.dualui.shared.TajawalFamily
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import app.dualui.core.engine.LauncherViewModel
import app.dualui.core.engine.LauncherSkin
import app.dualui.core.engine.SkinHost
import app.dualui.core.model.ThemeMode
import app.dualui.settings.SettingsScreen
import app.dualui.settings.SkinChoice

private const val ROUTE_SETUP = "setup"
private const val ROUTE_HOME = "home"
private const val ROUTE_SETTINGS = "settings?section={section}"
private const val ROUTE_PREVIEW = "preview/{id}"

/** App shell: Arabic-first (forced RTL) navigation between setup, home, live preview and settings. */
@Composable
fun LauncherRoot(vm: LauncherViewModel, versionName: String) {
    val prefs by vm.prefs.collectAsState()
    val p = prefs
    val systemDark = isSystemInDarkTheme()
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        if (p == null) { Box(Modifier.fillMaxSize()); return@CompositionLocalProvider }
        val dark = when (p.themeMode) { ThemeMode.DARK -> true; ThemeMode.LIGHT -> false; ThemeMode.SYSTEM -> systemDark }
        val nav = rememberNavController()
        val start = if (p.setupDone && SkinRegistry.byId(p.skinId) != null) ROUTE_HOME else ROUTE_SETUP
        val activeSkin = SkinRegistry.byId(p.skinId) ?: SkinRegistry.all.first()

        // Pressing Home while a sub-screen is open returns to the home screen.
        LaunchedEffect(Unit) {
            vm.homePressed.collect { vm.panel.close(); if (nav.currentDestination?.route?.startsWith("settings") == true || nav.currentDestination?.route == ROUTE_PREVIEW) nav.popBackStack(ROUTE_HOME, false) }
        }

        NavHost(
            nav, startDestination = start,
            enterTransition = { fadeIn(tween(220)) + slideInHorizontally(tween(260)) { -it / 10 } },
            exitTransition = { fadeOut(tween(160)) },
            popEnterTransition = { fadeIn(tween(200)) },
            popExitTransition = { fadeOut(tween(180)) + slideOutHorizontally(tween(240)) { -it / 10 } },
        ) {
            composable(ROUTE_SETUP) {
                SetupTheme(dark) {
                    SetupScreen(
                        vm = vm, skins = SkinRegistry.all,
                        onPreview = { nav.navigate("preview/${it.id}") },
                        onDone = { nav.navigate(ROUTE_HOME) { popUpTo(ROUTE_SETUP) { inclusive = true } } },
                    )
                }
            }
            composable(ROUTE_HOME) {
                StatusBarTone(vm)
                HomeWithSystemUi(vm, activeSkin, dark, p.effectivePanel()) { section -> nav.navigate(settingsRoute(section)) }
            }
            composable(ROUTE_PREVIEW) { entry ->
                val skin = SkinRegistry.byId(entry.arguments?.getString("id")) ?: activeSkin
                PreviewScreen(vm, skin, dark, nav)
            }
            composable(ROUTE_SETTINGS) { entry ->
                activeSkin.Theme(dark) {
                    SettingsScreen(
                        vm = vm, skins = SkinRegistry.all.map { SkinChoice(it.id, it.nameRes) }, versionName = versionName,
                        section = entry.arguments?.getString("section")?.takeIf { it.isNotEmpty() },
                        onBack = { nav.popBackStack() },
                    )
                }
            }
        }
    }
}

private fun settingsRoute(section: String?) = "settings?section=${section ?: ""}"

/** Real, running copy of a skin shown before the user commits to it. */
@Composable
private fun PreviewScreen(vm: LauncherViewModel, skin: LauncherSkin, dark: Boolean, nav: NavHostController) {
    BackHandler { nav.popBackStack() }
    Box(Modifier.fillMaxSize()) {
        skin.Theme(dark) {
            Box(Modifier.fillMaxSize()) {
                skin.Home(SkinHost(vm) { })
                Row(
                    Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 150.dp),
                ) {
                    PreviewBar(skin, onApply = {
                        vm.setSkin(skin.id); vm.finishSetup()
                        nav.navigate(ROUTE_HOME) { popUpTo(0) { inclusive = true } }
                    }, onBack = { nav.popBackStack() })
                }
            }
        }
    }
}

@Composable
private fun StatusBarTone(vm: LauncherViewModel) {
    val tone by vm.services.wallpaper.tone.collectAsState()
    val view = LocalView.current
    SideEffect {
        val w = (view.context as? android.app.Activity)?.window ?: return@SideEffect
        val c = WindowCompat.getInsetsController(w, view)
        c.isAppearanceLightStatusBars = tone.supportsDarkText
        c.isAppearanceLightNavigationBars = tone.supportsDarkText
    }
}

/**
 * Home screen + the notification / status-bar style the user picked.
 *  - "system": the device's own status bar and notification shade (nothing is replaced).
 *  - "samsung" / "pixel": the real status bar is hidden on the home screen only and replaced by a launcher-drawn strip;
 *    pulling it down opens that interface's panel. Swiping from the very top edge still reveals the real bar briefly.
 */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun HomeWithSystemUi(vm: LauncherViewModel, skin: LauncherSkin, dark: Boolean, style: String, openSettings: (String?) -> Unit) {
    val custom = style != "system" && SkinRegistry.byId(style) != null
    val view = LocalView.current
    DisposableEffect(custom) {
        val w = (view.context as? android.app.Activity)?.window
        val c = w?.let { WindowCompat.getInsetsController(it, view) }
        if (custom) {
            c?.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            c?.hide(androidx.core.view.WindowInsetsCompat.Type.statusBars())
        } else c?.show(androidx.core.view.WindowInsetsCompat.Type.statusBars())
        onDispose { c?.show(androidx.core.view.WindowInsetsCompat.Type.statusBars()) }
    }
    BackHandler(enabled = vm.panel.visible) { vm.panel.close() }
    val barH = androidx.compose.foundation.layout.WindowInsets.statusBarsIgnoringVisibility.asPaddingValues().calculateTopPadding()
    val tone by vm.services.wallpaper.tone.collectAsState()
    val host = remember(vm) { SkinHost(vm, openSettings) }
    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().padding(top = if (custom) barH.coerceAtLeast(24.dp) else 0.dp)) {
            skin.Theme(dark) { skin.Home(host) }
        }
        if (custom) {
            val ink = if (tone.supportsDarkText) Color(0xFF111111) else Color.White
            val pixel = style == "pixel"
            Box(Modifier.align(Alignment.TopCenter)) {
                app.dualui.shared.LauncherStatusBar(
                    vm, ink, if (pixel) app.dualui.shared.PlexArabicFamily else TajawalFamily,
                    textSp = if (pixel) 14 else 13, iconDp = if (pixel) 17 else 15,
                )
            }
            SkinRegistry.byId(style)?.Panel(host, vm.panel, dark)
        }
    }
}
