package com.kachingo.myapp.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.graphics.Color
import android.widget.RemoteViews
import com.kachingo.myapp.R

class QuickActionsWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
    ids.forEach { id ->
      val views = RemoteViews(ctx.packageName, R.layout.widget_quick_actions)
      // Apply white tint via setColorFilter (works on all API levels unlike XML android:tint)
      views.setInt(R.id.qa_capture_icon, "setColorFilter", Color.WHITE)
      views.setInt(R.id.qa_add_icon, "setColorFilter", Color.WHITE)
      views.setOnClickPendingIntent(R.id.qa_capture_btn, pendingIntentForUri(ctx, "kachingo://capture"))
      views.setOnClickPendingIntent(R.id.qa_add_btn, pendingIntentForUri(ctx, "kachingo://add"))
      mgr.updateAppWidget(id, views)
    }
  }
}
