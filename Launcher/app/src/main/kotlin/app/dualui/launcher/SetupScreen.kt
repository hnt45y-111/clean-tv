package app.dualui.launcher

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.LauncherSkin
import app.dualui.core.engine.LauncherViewModel
import app.dualui.settings.isDefaultHome
import app.dualui.settings.requestHome
import app.dualui.shared.TajawalFamily
import app.dualui.shared.typographyOf

@Composable
fun SetupTheme(dark: Boolean, content: @Composable () -> Unit) {
    val scheme = if (dark) darkColorScheme(primary = Color(0xFF7FB2FF), onPrimary = Color(0xFF00224D), background = Color(0xFF0E1117),
        surface = Color(0xFF181C24), onSurface = Color(0xFFEDEFF4), surfaceVariant = Color(0xFF242A35), onSurfaceVariant = Color(0xFFA9B0BF))
    else lightColorScheme(primary = Color(0xFF1F6FEB), onPrimary = Color.White, background = Color(0xFFF3F5FA),
        surface = Color.White, onSurface = Color(0xFF14171F), surfaceVariant = Color(0xFFE6EAF2), onSurfaceVariant = Color(0xFF586071))
    MaterialTheme(colorScheme = scheme, typography = typographyOf(TajawalFamily), content = content)
}

/** First-run screen: two large interface cards with a visual preview, live preview, and selection. */
@Composable
fun SetupScreen(vm: LauncherViewModel, skins: List<LauncherSkin>, onPreview: (LauncherSkin) -> Unit, onDone: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    val ctx = LocalContext.current
    var selected by remember { mutableStateOf<LauncherSkin?>(null) }
    var step by remember { mutableIntStateOf(1) }
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { onDone() }

    Box(Modifier.fillMaxSize().background(cs.background).windowInsetsPadding(WindowInsets.systemBars)) {
        AnimatedContent(step, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "setup") { s ->
            if (s == 1) Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 20.dp)) {
                Text(stringResource(R.string.setup_title), color = cs.onSurface, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                Text(stringResource(R.string.setup_sub), color = cs.onSurfaceVariant, fontSize = 14.sp, lineHeight = 22.sp, modifier = Modifier.padding(top = 8.dp, bottom = 22.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    skins.forEach { skin ->
                        SkinCard(skin, selected == skin, Modifier.weight(1f), onPreview = { onPreview(skin) }, onSelect = { selected = skin })
                    }
                }
                Spacer(Modifier.height(24.dp))
                Button(
                    onClick = { selected?.let { vm.setSkin(it.id); vm.finishSetup(); step = 2 } },
                    enabled = selected != null,
                    modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(28.dp),
                ) { Text(stringResource(R.string.setup_start), fontSize = 16.sp, fontWeight = FontWeight.Bold) }
            } else Column(
                Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
            ) {
                Box(Modifier.size(96.dp).clip(RoundedCornerShape(30.dp)).background(cs.primary), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.Home, null, tint = cs.onPrimary, modifier = Modifier.size(52.dp))
                }
                Text(stringResource(R.string.setup_default_title), color = cs.onSurface, fontSize = 26.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 24.dp))
                Text(stringResource(R.string.setup_default_body), color = cs.onSurfaceVariant, fontSize = 14.sp, lineHeight = 23.sp,
                    textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 14.dp))
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { if (isDefaultHome(ctx)) onDone() else requestHome(ctx) { roleLauncher.launch(it) } },
                    modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(28.dp),
                ) { Text(stringResource(R.string.setup_default_button), fontSize = 16.sp, fontWeight = FontWeight.Bold) }
                TextButton(onClick = onDone, modifier = Modifier.padding(top = 8.dp)) { Text(stringResource(R.string.setup_later)) }
            }
        }
    }
}

@Composable
private fun SkinCard(skin: LauncherSkin, selected: Boolean, modifier: Modifier, onPreview: () -> Unit, onSelect: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    val scale by animateFloatAsState(if (selected) 1f else 0.97f, label = "card")
    Column(
        modifier.graphicsLayer { scaleX = scale; scaleY = scale }
            .clip(RoundedCornerShape(28.dp)).background(cs.surface)
            .border(if (selected) 2.5.dp else 1.dp, if (selected) cs.primary else cs.surfaceVariant, RoundedCornerShape(28.dp))
            .clickable(onClick = onSelect).padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        skin.Preview(Modifier.fillMaxWidth().aspectRatio(0.56f).clip(RoundedCornerShape(20.dp)))
        Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (selected) { Icon(Icons.Rounded.CheckCircle, null, tint = cs.primary, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(6.dp)) }
            Text(stringResource(skin.nameRes), color = cs.onSurface, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
        Text(stringResource(skin.taglineRes), color = cs.onSurfaceVariant, fontSize = 12.sp, lineHeight = 18.sp, textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp, bottom = 10.dp, start = 4.dp, end = 4.dp))
        OutlinedButton(onClick = onPreview, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
            Text(stringResource(R.string.setup_preview), fontSize = 13.sp)
        }
        Spacer(Modifier.height(6.dp))
        Button(onClick = onSelect, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp),
            colors = if (selected) ButtonDefaults.buttonColors() else ButtonDefaults.filledTonalButtonColors()) {
            Text(stringResource(if (selected) R.string.setup_selected else R.string.setup_choose), fontSize = 13.sp)
        }
    }
}

@Composable
fun PreviewBar(skin: LauncherSkin, onApply: () -> Unit, onBack: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(32.dp)).background(Color(0xE6101218)).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(stringResource(R.string.preview_banner, stringResource(skin.nameRes)), color = Color.White, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 10.dp))
        FilledTonalButton(onClick = onBack, shape = RoundedCornerShape(20.dp), contentPadding = PaddingValues(horizontal = 14.dp)) { Text(stringResource(R.string.preview_back), fontSize = 13.sp) }
        Button(onClick = onApply, shape = RoundedCornerShape(20.dp), contentPadding = PaddingValues(horizontal = 14.dp)) { Text(stringResource(R.string.preview_apply), fontSize = 13.sp) }
    }
}
