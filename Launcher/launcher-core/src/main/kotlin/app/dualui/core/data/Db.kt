package app.dualui.core.data

import android.content.Context
import androidx.room.*
import app.dualui.core.model.HomeItem
import kotlinx.coroutines.flow.Flow

@Dao
interface HomeDao {
    @Query("SELECT * FROM home_items ORDER BY id")
    fun observeAll(): Flow<List<HomeItem>>

    @Query("SELECT * FROM home_items ORDER BY id")
    suspend fun all(): List<HomeItem>

    @Insert
    suspend fun insert(item: HomeItem): Long

    @Update
    suspend fun update(items: List<HomeItem>)

    @Query("DELETE FROM home_items WHERE id IN (:ids)")
    suspend fun delete(ids: List<Long>)

    @Query("DELETE FROM home_items")
    suspend fun clear()
}

@Database(entities = [HomeItem::class], version = 1, exportSchema = false)
abstract class LauncherDb : RoomDatabase() {
    abstract fun home(): HomeDao

    companion object {
        @Volatile private var instance: LauncherDb? = null
        fun get(context: Context): LauncherDb = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, LauncherDb::class.java, "launcher.db")
                .build().also { instance = it }
        }
    }
}
