package app.dualui.core.engine

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Stable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Drives a finger-following overlay (app drawer / control panel): 0 = closed, 1 = fully open. */
@Stable
class Reveal(private val scope: CoroutineScope) {
    private val anim = Animatable(0f)
    val progress: Float get() = anim.value
    val visible: Boolean get() = anim.value > 0.002f || anim.targetValue > 0f
    val isOpen: Boolean get() = anim.targetValue >= 0.5f

    fun drag(p: Float) { scope.launch { anim.snapTo(p.coerceIn(0f, 1f)) } }
    fun settle(open: Boolean) {
        scope.launch { anim.animateTo(if (open) 1f else 0f, spring(dampingRatio = 0.88f, stiffness = Spring.StiffnessMediumLow)) }
    }
    fun open() = settle(true)
    fun close() = settle(false)
}
