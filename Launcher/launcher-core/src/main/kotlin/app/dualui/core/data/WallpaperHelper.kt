package app.dualui.core.data

import android.app.WallpaperColors
import android.app.WallpaperManager
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

/** Built-in gradient wallpapers (rendered on demand; no image assets shipped). */
enum class WallpaperPreset(val label: String, val top: Int, val bottom: Int, val glow: Int) {
    AURORA("أورورا", 0xFF1B2A6B.toInt(), 0xFF7B3FA0.toInt(), 0xFF4FC3F7.toInt()),
    DUNES("كثبان", 0xFFF2B880.toInt(), 0xFF8C4A3A.toInt(), 0xFFFFE0B2.toInt()),
    LAGOON("بحيرة", 0xFF0E5C63.toInt(), 0xFF0B2B3B.toInt(), 0xFF80DEEA.toInt()),
    ORCHID("أوركيد", 0xFFE9B7D3.toInt(), 0xFF6A4C93.toInt(), 0xFFFFF1F8.toInt()),
    MEADOW("مرج", 0xFFB7D88C.toInt(), 0xFF2F5D3A.toInt(), 0xFFF4FFD6.toInt()),
    NIGHT("ليل", 0xFF111827.toInt(), 0xFF000000.toInt(), 0xFF3B4A7A.toInt()),
}

data class WallpaperTone(val supportsDarkText: Boolean = false, val primary: Color? = null)

class WallpaperHelper(context: Context) {
    private val ctx = context.applicationContext
    private val wm = WallpaperManager.getInstance(ctx)

    private val _tone = MutableStateFlow(read())
    val tone: StateFlow<WallpaperTone> = _tone.asStateFlow()

    private val listener = WallpaperManager.OnColorsChangedListener { _, _ -> _tone.value = read() }

    fun start() { try { wm.addOnColorsChangedListener(listener, android.os.Handler(android.os.Looper.getMainLooper())) } catch (_: Exception) {}; _tone.value = read() }
    fun stop() { try { wm.removeOnColorsChangedListener(listener) } catch (_: Exception) {} }

    private fun read(): WallpaperTone {
        val c = try { wm.getWallpaperColors(WallpaperManager.FLAG_SYSTEM) } catch (_: Exception) { null }
        return WallpaperTone(
            supportsDarkText = c != null && (c.colorHints and WallpaperColors.HINT_SUPPORTS_DARK_TEXT) != 0,
            primary = c?.primaryColor?.toArgb()?.let { Color(it) },
        )
    }

    suspend fun setFromUri(uri: Uri): Boolean = withContext(Dispatchers.IO) {
        try {
            ctx.contentResolver.openInputStream(uri)?.use { wm.setStream(it) }
            true
        } catch (_: Exception) { false }
    }

    suspend fun setPreset(p: WallpaperPreset): Boolean = withContext(Dispatchers.Default) {
        try {
            val dm = ctx.resources.displayMetrics
            val w = dm.widthPixels; val h = dm.heightPixels
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            paint.shader = LinearGradient(0f, 0f, w * 0.4f, h.toFloat(), p.top, p.bottom, Shader.TileMode.CLAMP)
            c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), paint)
            paint.shader = RadialGradient(w * 0.75f, h * 0.22f, w * 0.85f,
                (p.glow and 0x00FFFFFF) or 0x66000000, p.glow and 0x00FFFFFF, Shader.TileMode.CLAMP)
            c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), paint)
            paint.shader = RadialGradient(w * 0.1f, h * 0.85f, w * 0.7f,
                (p.top and 0x00FFFFFF) or 0x55000000, p.top and 0x00FFFFFF, Shader.TileMode.CLAMP)
            c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), paint)
            withContext(Dispatchers.IO) { wm.setBitmap(bmp) }
            true
        } catch (_: Exception) { false }
    }

    /** The system's own wallpaper picker, for users who prefer the official one. */
    fun systemChooser(): Intent = Intent.createChooser(Intent(Intent.ACTION_SET_WALLPAPER), null)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
