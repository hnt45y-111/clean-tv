package app.dualui.pixel

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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

/** Google Pixel interface. Registered in the app's SkinRegistry. */
object PixelSkin : LauncherSkin {
    override val id = "pixel"
    override val nameRes = R.string.pixel_name
    override val taglineRes = R.string.pixel_tagline
    override val headerRows = 1

    @Composable override fun Theme(dark: Boolean, content: @Composable () -> Unit) = PixelTheme(dark, content)
    @Composable override fun Home(host: SkinHost) = PixelHome(host)
    @Composable override fun Preview(modifier: Modifier) = PixelPreview(modifier)
}

@Composable
private fun PixelPreview(modifier: Modifier) {
    val apps by LauncherServices.get(LocalContext.current).apps.apps.collectAsState()
    Box(modifier.background(Brush.verticalGradient(listOf(Color(0xFFF2B880), Color(0xFF8C4A3A))))) {
        Column(Modifier.fillMaxSize().padding(10.dp)) {
            Text("الإثنين، ٢٤ نوفمبر", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 10.dp, start = 4.dp))
            Text("٩:٤١ م  •  ٨٢٪", color = Color.White.copy(alpha = .9f), fontSize = 9.sp, modifier = Modifier.padding(start = 4.dp, bottom = 12.dp))
            apps.take(8).chunked(4).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    row.forEach { AppIcon(it, 30.dp, CircleShape) }
                }
            }
            Spacer(Modifier.weight(1f))
            Row(Modifier.fillMaxWidth().padding(bottom = 6.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                apps.take(4).forEach { AppIcon(it, 30.dp, CircleShape) }
            }
            Box(Modifier.fillMaxWidth().height(24.dp).clip(RoundedCornerShape(12.dp)).background(Color.White.copy(alpha = .85f)),
                contentAlignment = Alignment.CenterStart) {
                Text("ابحث في جهازك والويب", color = Color(0xFF44474E), fontSize = 8.sp, modifier = Modifier.padding(horizontal = 10.dp))
            }
        }
    }
}
