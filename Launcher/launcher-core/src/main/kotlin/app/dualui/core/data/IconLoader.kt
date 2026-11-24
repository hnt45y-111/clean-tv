package app.dualui.core.data

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import app.dualui.core.model.AppInfo

/** Colours used when rendering Material-You "themed" monochrome icons. */
data class ThemedIconColors(val background: Int, val foreground: Int)

/**
 * Renders every launcher icon to a full-bleed square bitmap. The skin then clips it to its own icon shape
 * (squircle for Samsung, circle for Pixel), so both interfaces get consistent, shape-masked icons even
 * for legacy non-adaptive apps.
 */
class IconLoader(private val repo: AppRepository) {
    private val cache = object : LruCache<String, ImageBitmap>(320) {}

    fun cached(app: AppInfo, size: Int, themed: ThemedIconColors?): ImageBitmap? = cache.get(cacheKey(app, size, themed))

    fun load(app: AppInfo, size: Int, themed: ThemedIconColors?): ImageBitmap? {
        val k = cacheKey(app, size, themed)
        cache.get(k)?.let { return it }
        val d = repo.iconDrawable(app) ?: return null
        val bmp = render(d, size, themed).asImageBitmap()
        cache.put(k, bmp)
        return bmp
    }

    private fun cacheKey(app: AppInfo, size: Int, t: ThemedIconColors?) = "${app.key}|${app.user.hashCode()}|$size|${t?.background}|${t?.foreground}"

    private fun render(d: Drawable, size: Int, themed: ThemedIconColors?): Bitmap {
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val ext = (size * 0.25f).toInt()
        if (d is AdaptiveIconDrawable) {
            val mono = if (themed != null && Build.VERSION.SDK_INT >= 33) d.monochrome else null
            if (mono != null) {
                c.drawColor(themed!!.background)
                mono.mutate().apply { setTint(themed.foreground); setBounds(-ext, -ext, size + ext, size + ext); draw(c) }
            } else {
                d.background?.apply { setBounds(-ext, -ext, size + ext, size + ext); draw(c) }
                d.foreground?.apply { setBounds(-ext, -ext, size + ext, size + ext); draw(c) }
            }
        } else {
            c.drawColor(0xFFF2F2F5.toInt())
            val inset = (size * 0.14f).toInt()
            d.setBounds(inset, inset, size - inset, size - inset)
            d.draw(c)
        }
        return bmp
    }
}
