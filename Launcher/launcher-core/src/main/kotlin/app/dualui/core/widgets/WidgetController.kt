package app.dualui.core.widgets

import android.app.Activity
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetHostView
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.viewinterop.AndroidView

/** Thin wrapper around the official [AppWidgetHost] so skins can show real third-party widgets. */
class WidgetController(context: Context) {
    private val ctx = context.applicationContext
    val manager: AppWidgetManager = AppWidgetManager.getInstance(ctx)
    val host = AppWidgetHost(ctx, HOST_ID)

    fun start() { try { host.startListening() } catch (_: Exception) {} }
    fun stop() { try { host.stopListening() } catch (_: Exception) {} }

    fun allocateId(): Int = host.allocateAppWidgetId()
    fun delete(id: Int) { try { host.deleteAppWidgetId(id) } catch (_: Exception) {} }
    fun info(id: Int): AppWidgetProviderInfo? = manager.getAppWidgetInfo(id)
    fun installedProviders(): List<AppWidgetProviderInfo> = manager.installedProviders
        .filter { it.provider.packageName != ctx.packageName }

    /** true = bound immediately; false = the user must approve (launch ACTION_APPWIDGET_BIND). */
    fun bindIfAllowed(id: Int, provider: ComponentName): Boolean = manager.bindAppWidgetIdIfAllowed(id, provider)

    fun configure(activity: Activity, id: Int, requestCode: Int) {
        host.startAppWidgetConfigureActivityForResult(activity, id, 0, requestCode, null)
    }

    /** Default span in grid cells, using the same (size + 30) / 70 rule AOSP launchers use. */
    fun spanFor(info: AppWidgetProviderInfo, cols: Int, rows: Int): Pair<Int, Int> {
        val dm = ctx.resources.displayMetrics
        fun cells(px: Int): Int {
            val dp = px / dm.density
            return ((dp + 30) / 70).toInt().coerceAtLeast(1)
        }
        return cells(info.minWidth).coerceAtMost(cols) to cells(info.minHeight).coerceAtMost((rows - 1).coerceAtLeast(1))
    }

    companion object { const val HOST_ID = 0x4455 }
}

/** Hosts a real widget inside Compose. */
@Composable
fun WidgetView(controller: WidgetController, widgetId: Int, modifier: Modifier = Modifier.fillMaxSize()) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val view = remember(widgetId) {
        controller.info(widgetId)?.let { info ->
            controller.host.createView(context, widgetId, info).apply { setPadding(0, 0, 0, 0) }
        }
    }
    if (view != null) {
        AndroidView(
            factory = { view.apply { (parent as? android.view.ViewGroup)?.removeView(this) } },
            modifier = modifier,
            update = { v ->
                val w = v.width; val h = v.height
                if (w > 0 && h > 0) {
                    val wd = (w / density.density).toInt(); val hd = (h / density.density).toInt()
                    (v as AppWidgetHostView).updateAppWidgetSize(Bundle.EMPTY, wd, hd, wd, hd)
                }
            },
        )
    }
}
