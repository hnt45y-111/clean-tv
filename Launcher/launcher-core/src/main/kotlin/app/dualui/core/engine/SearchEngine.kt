package app.dualui.core.engine

import app.dualui.core.model.AppInfo

/** Arabic-aware app search: ignores diacritics/tatweel and unifies alef / yaa / taa-marbuta variants. */
object SearchEngine {
    fun normalize(s: String): String {
        val sb = StringBuilder(s.length)
        for (ch in s.lowercase()) {
            when (ch) {
                'أ', 'إ', 'آ', 'ٱ' -> sb.append('ا')
                'ى' -> sb.append('ي')
                'ة' -> sb.append('ه')
                'ـ', in 'ً'..'ٟ', 'ٰ' -> {}
                else -> sb.append(ch)
            }
        }
        return sb.toString().trim()
    }

    fun search(query: String, apps: List<AppInfo>): List<AppInfo> {
        val q = normalize(query)
        if (q.isEmpty()) return emptyList()
        val scored = apps.mapNotNull { a ->
            val n = normalize(a.label)
            val score = when {
                n.startsWith(q) -> 0
                n.split(' ').any { it.startsWith(q) } -> 1
                n.contains(q) -> 2
                normalize(a.packageName).contains(q) -> 3
                else -> return@mapNotNull null
            }
            score to a
        }
        return scored.sortedBy { it.first }.map { it.second }
    }
}
