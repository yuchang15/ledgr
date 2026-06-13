package com.kachingo.myapp.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.os.Build
import android.widget.RemoteViews
import com.kachingo.myapp.R

class DonutWidget : AppWidgetProvider() {

  companion object {
    const val SWAP_ACTION = "com.kachingo.myapp.widget.SWAP_DONUT"
    private const val PREFS = "kachingo_donut_widget"
    private const val KEY_SHOW_INCOME = "show_income"
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == SWAP_ACTION) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val current = prefs.getBoolean(KEY_SHOW_INCOME, false)
      prefs.edit().putBoolean(KEY_SHOW_INCOME, !current).apply()
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(ComponentName(context, DonutWidget::class.java))
      onUpdate(context, mgr, ids)
    }
  }

  override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
    ids.forEach { id -> updateWidget(ctx, mgr, id) }
  }

  private fun updateWidget(ctx: Context, mgr: AppWidgetManager, id: Int) {
    val data = WidgetDataManager.load(ctx)
    val views = RemoteViews(ctx.packageName, R.layout.widget_donut)

    val showIncome = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getBoolean(KEY_SHOW_INCOME, false)

    val sym = data?.symbol ?: "$"

    if (showIncome) {
      val income = data?.income ?: 0.0
      views.setTextViewText(R.id.info_label, "Total Income")
      views.setTextViewText(R.id.info_amount, WidgetDataManager.fmt(income, sym))
      views.setInt(R.id.info_amount, "setTextColor", Color.parseColor("#4ade80"))
    } else {
      val rem = data?.remaining ?: 0.0
      views.setTextViewText(R.id.info_label, "Remaining")
      views.setTextViewText(R.id.info_amount, WidgetDataManager.fmt(rem, sym))
      views.setInt(R.id.info_amount, "setTextColor",
        if (rem >= 0) Color.WHITE else Color.parseColor("#FCA5A5"))
    }

    val size = 160
    views.setImageViewBitmap(R.id.donut_chart, drawDonut(data?.slices ?: emptyList(), size, showIncome))

    // Swap button toggles expense/income view
    val swapIntent = Intent(SWAP_ACTION).setPackage(ctx.packageName)
    val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else PendingIntent.FLAG_UPDATE_CURRENT
    val swapPi = PendingIntent.getBroadcast(ctx, id, swapIntent, piFlags)
    views.setOnClickPendingIntent(R.id.swap_btn, swapPi)

    views.setOnClickPendingIntent(R.id.donut_root, pendingIntentForUri(ctx, "kachingo://home"))

    mgr.updateAppWidget(id, views)
  }

  private fun drawDonut(slices: List<SliceInfo>, size: Int, showIncome: Boolean): Bitmap {
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE
      strokeWidth = size * 0.13f
    }
    val r = size * 0.28f
    val rect = RectF(size / 2f - r, size / 2f - r, size / 2f + r, size / 2f + r)

    // Background track
    paint.color = Color.argb(50, 255, 255, 255)
    canvas.drawArc(rect, -90f, 360f, false, paint)

    if (showIncome) {
      paint.color = Color.parseColor("#4ade80")
      canvas.drawArc(rect, -90f, 360f, false, paint)
    } else {
      var sweep = -90f
      slices.forEach { s ->
        paint.color = parseColor(s.color)
        val angle = (s.percent / 100f * 360f).toFloat()
        canvas.drawArc(rect, sweep, angle, false, paint)
        sweep += angle
      }
    }
    return bmp
  }

  private fun parseColor(hex: String): Int = try {
    Color.parseColor(if (hex.startsWith("#")) hex else "#$hex")
  } catch (e: Exception) { Color.GRAY }
}
