package com.kachingo.myapp.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KachingoWidgetBridgeModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "KachingoWidgetBridge"

  @ReactMethod
  fun updateWidgetData(json: String) {
    WidgetDataManager.save(reactContext, json)
    listOf(
      DonutWidget::class.java,
      CaptureWidget::class.java,
      QuickActionsWidget::class.java,
      GoalWidget::class.java,
    ).forEach { cls ->
      val mgr = AppWidgetManager.getInstance(reactContext)
      val ids = mgr.getAppWidgetIds(ComponentName(reactContext, cls))
      if (ids.isNotEmpty()) {
        val intent = Intent(reactContext, cls).apply {
          action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        reactContext.sendBroadcast(intent)
      }
    }
  }
}
