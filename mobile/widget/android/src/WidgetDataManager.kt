package com.kachingo.myapp.widget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object WidgetDataManager {
  private const val PREFS = "kachingo_widget"
  private const val KEY   = "widget_data"

  fun save(context: Context, json: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit().putString(KEY, json).apply()
  }

  fun load(context: Context): WidgetData? {
    val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY, null) ?: return null
    return try {
      val o = JSONObject(json)
      val slicesArr = o.optJSONArray("slices") ?: JSONArray()
      val slices = (0 until slicesArr.length()).map {
        val s = slicesArr.getJSONObject(it)
        SliceInfo(s.getString("color"), s.getDouble("percent"), s.getString("label"))
      }
      val ms = if (!o.isNull("monthlySavings")) {
        val m = o.getJSONObject("monthlySavings")
        if (m.getBoolean("enabled"))
          MonthlySavings(m.getDouble("target"), m.getDouble("saved"))
        else null
      } else null
      val cg = if (!o.isNull("customGoal")) {
        val c = o.getJSONObject("customGoal")
        CustomGoalData(c.getString("name"), c.getDouble("target"), c.getDouble("saved"), c.getString("color"))
      } else null
      WidgetData(
        income     = o.getDouble("income"),
        expenses   = o.getDouble("expenses"),
        remaining  = o.getDouble("remaining"),
        symbol     = o.optString("currencySymbol", "$"),
        slices     = slices,
        monthlySavings = ms,
        customGoal = cg,
      )
    } catch (e: Exception) { null }
  }

  fun fmt(value: Double, symbol: String): String {
    val abs = kotlin.math.abs(value)
    return when {
      abs >= 1_000_000 -> "$symbol${String.format("%.1fM", abs / 1_000_000)}"
      abs >= 1_000     -> "$symbol${String.format("%.1fK", abs / 1_000)}"
      else             -> "$symbol${String.format("%.0f", abs)}"
    }
  }
}

data class SliceInfo(val color: String, val percent: Double, val label: String)
data class MonthlySavings(val target: Double, val saved: Double)
data class CustomGoalData(val name: String, val target: Double, val saved: Double, val color: String)
data class WidgetData(
  val income: Double,
  val expenses: Double,
  val remaining: Double,
  val symbol: String,
  val slices: List<SliceInfo>,
  val monthlySavings: MonthlySavings?,
  val customGoal: CustomGoalData?,
)
