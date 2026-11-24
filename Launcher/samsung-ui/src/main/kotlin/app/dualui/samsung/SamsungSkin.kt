package app.dualui.samsung

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.engine.LauncherServices
import app.dualui.core.engine.LauncherSkin
import app.dualui.core.engine.SkinHost
import app.dualui.shared.AppIcon

/** Samsung One UI interface. Registered in the app's SkinRegistry. */
object SamsungSkin : LauncherSkin {
    override val id = "samsung"
    override val nameRes = R.string.samsung_name
    override val taglineRes = R.string.samsung_tagline
    override val headerRows = 2

    @Composable override fun Theme(dark: Boolean, content: @Composable () -> Unit) = SamsungTheme(dark, content)
    @Composable override fun Home(host: SkinHost) = SamsungHome(host)
    @Composable override fun Panel(host: SkinHost, reveal: app.dualui.core.engine.Reveal, dark: Boolean) = SamsungTheme(dark) { SamsungControlCenter(host, reveal, dark) }
    @Composable override fun Preview(modifier: Modifier) = SamsungPreview(modifier)
}

/** Miniature of the real layout (real installed icons) for the setup screen. */
@Composable
private fun SamsungPreview(modifier: Modifier) {
    val apps by LauncherServices.get(LocalContext.current).apps.apps.collectAsState()
    Box(
        modifier.background(Brush.linearGradient(listOf(Color(0xFF1B2A6B), Color(0xFF7B3FA0)))),
    ) {
        Column(Modifier.fillMaxSize().padding(10.dp)) {
            Text("٩:٤١", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Normal, modifier = Modifier.padding(top = 10.dp, start = 6.dp))
            Text("الإثنين، ٢٤ نوفمبر", color = Color.White.copy(alpha = .85f), fontSize = 9.sp, modifier = Modifier.padding(start = 6.dp, bottom = 10.dp))
            apps.take(12).chunked(4).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    row.forEach { AppIcon(it, 30.dp, SamsungIconShape) }
                }
            }
            Spacer(Modifier.weight(1f))
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color.White.copy(alpha = .2f)).padding(8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically,
            ) { apps.take(4).forEach { AppIcon(it, 30.dp, SamsungIconShape) } }
        }
    }
}
