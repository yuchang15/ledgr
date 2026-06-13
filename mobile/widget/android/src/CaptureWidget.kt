package com.kachingo.myapp.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.graphics.Color
import android.widget.RemoteViews
import com.kachingo.myapp.R

class CaptureWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
    ids.forEach { id ->
      val views = RemoteViews(ctx.packageName, R.layout.widget_capture)
      // setColorFilter is supported in RemoteViews across all API levels
      views.setInt(R.id.capture_icon, "setColorFilter", Color.WHITE)
      views.setOnClickPendingIntent(R.id.capture_root, pendingIntentForUri(ctx, "kachingo://capture"))
      mgr.updateAppWidget(id, views)
    }
  }
}
