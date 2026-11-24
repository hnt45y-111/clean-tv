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
            vm.homePressed.collect { if (nav.currentDestination?.route?.startsWith("settings") == true || nav.currentDestination?.route == ROUTE_PREVIEW) nav.popBackStack(ROUTE_HOME, false) }
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
                activeSkin.Theme(dark) { activeSkin.Home(SkinHost(vm) { section -> nav.navigate(settingsRoute(section)) }) }
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
