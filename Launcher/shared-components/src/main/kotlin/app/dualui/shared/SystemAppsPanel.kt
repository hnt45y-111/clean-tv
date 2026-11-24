package app.dualui.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.dualui.core.data.SystemApp

class SystemAppsStyle(val tileShape: Shape, val tile: Color, val icon: Color, val label: Color, val font: FontFamily)

/** The "system apps" area: shortcuts that open the REAL installed calculator, clock, calendar, ... (never fake apps). */
@Composable
fun SystemAppsPanel(style: SystemAppsStyle, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val available = remember { SystemApp.entries.filter { it.isAvailable(context) } }
    Row(modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        available.take(7).forEach { sys ->
            Column(
                Modifier.weight(1f).clip(style.tileShape).clickable { sys.open(context) }.padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.size(46.dp).clip(style.tileShape).background(style.tile), contentAlignment = Alignment.Center) {
                    Icon(sys.icon, null, tint = style.icon, modifier = Modifier.size(24.dp))
                }
                Spacer(Modifier.height(4.dp))
                Text(stringResource(sys.label), color = style.label, fontFamily = style.font, fontSize = 10.sp,
                    fontWeight = FontWeight.Medium, maxLines = 1)
            }
        }
    }
}
