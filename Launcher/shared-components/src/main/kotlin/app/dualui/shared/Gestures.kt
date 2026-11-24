package app.dualui.shared

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.*
import androidx.compose.ui.input.pointer.util.VelocityTracker
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.abs

/**
 * One gesture recogniser for the whole workspace: tap, long-press (+ drag), and vertical swipes.
 * Horizontal movement is left alone so the page pager keeps working; once the pager consumes the event we bow out.
 * Doing everything here (instead of per-icon `clickable`s) keeps taps from firing after a drag.
 */
internal suspend fun PointerInputScope.workspaceGestures(
    enabled: () -> Boolean,
    onTap: (Offset) -> Unit,
    onLongPress: (Offset) -> Boolean,
    onDrag: (Offset) -> Unit,
    onDragEnd: (cancelled: Boolean) -> Unit,
    onVerticalDrag: (start: Offset, dy: Float) -> Unit,
    onVerticalEnd: (dy: Float, velocityY: Float, cancelled: Boolean) -> Unit,
) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        if (!enabled()) return@awaitEachGesture
        val slop = viewConfiguration.touchSlop
        var mode = MODE_LONG
        var last = down.position
        withTimeoutOrNull(viewConfiguration.longPressTimeoutMillis) {
            while (true) {
                val ev = awaitPointerEvent()
                val c = ev.changes.firstOrNull { it.id == down.id } ?: run { mode = MODE_CANCEL; return@withTimeoutOrNull }
                if (c.isConsumed) { mode = MODE_CANCEL; return@withTimeoutOrNull }
                last = c.position
                if (c.changedToUp()) { mode = MODE_TAP; return@withTimeoutOrNull }
                val d = c.position - down.position
                if (d.getDistance() > slop) {
                    mode = if (abs(d.y) > abs(d.x) * 1.2f) MODE_VERTICAL else MODE_CANCEL
                    return@withTimeoutOrNull
                }
            }
        }
        when (mode) {
            MODE_TAP -> onTap(last)
            MODE_VERTICAL -> {
                val vt = VelocityTracker()
                vt.addPosition(down.uptimeMillis, down.position)
                var total = 0f
                while (true) {
                    val ev = awaitPointerEvent()
                    val c = ev.changes.firstOrNull { it.id == down.id } ?: break
                    if (c.changedToUp()) { onVerticalEnd(total, vt.calculateVelocity().y, false); return@awaitEachGesture }
                    if (c.isConsumed) { onVerticalEnd(total, 0f, true); return@awaitEachGesture }
                    c.consume()
                    vt.addPosition(c.uptimeMillis, c.position)
                    total = c.position.y - down.position.y
                    onVerticalDrag(down.position, total)
                }
                onVerticalEnd(total, 0f, true)
            }
            MODE_LONG -> {
                if (!onLongPress(down.position)) return@awaitEachGesture
                while (true) {
                    val ev = awaitPointerEvent()
                    val c = ev.changes.firstOrNull { it.id == down.id } ?: break
                    c.consume()
                    if (c.changedToUp()) { onDragEnd(false); return@awaitEachGesture }
                    onDrag(c.position)
                }
                onDragEnd(true)
            }
        }
    }
}

private const val MODE_TAP = 1
private const val MODE_LONG = 2
private const val MODE_VERTICAL = 3
private const val MODE_CANCEL = 4
