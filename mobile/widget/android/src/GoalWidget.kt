package com.kachingo.myapp.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import com.kachingo.myapp.R

class GoalWidget : AppWidgetProvider() {
  override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
    ids.forEach { id ->
      val data = WidgetDataManager.load(ctx)
      val views = RemoteViews(ctx.packageName, R.layout.widget_goal)
      val sym = data?.symbol ?: "$"

      val hasMonthlySavings = data?.monthlySavings != null
      val hasCustomGoal = data?.customGoal != null
      val noGoals = !hasMonthlySavings && !hasCustomGoal

      if (noGoals) {
        views.setViewVisibility(R.id.goal_no_goals, View.VISIBLE)
        views.setViewVisibility(R.id.goal_monthly_section, View.GONE)
        views.setViewVisibility(R.id.goal_custom_section, View.GONE)
        views.setViewVisibility(R.id.goal_add_monthly, View.GONE)
        views.setViewVisibility(R.id.goal_add_custom, View.GONE)
      } else {
        views.setViewVisibility(R.id.goal_no_goals, View.GONE)

        if (hasMonthlySavings) {
          val ms = data!!.monthlySavings!!
          val pct = if (ms.target > 0) (ms.saved / ms.target).coerceIn(0.0, 1.0) else 0.0
          views.setViewVisibility(R.id.goal_monthly_section, View.VISIBLE)
          views.setViewVisibility(R.id.goal_add_monthly, View.GONE)
          views.setTextViewText(R.id.goal_monthly_saved, WidgetDataManager.fmt(ms.saved, sym))
          views.setTextViewText(R.id.goal_monthly_target, "/ ${WidgetDataManager.fmt(ms.target, sym)}")
          views.setProgressBar(R.id.goal_monthly_progress, 100, (pct * 100).toInt(), false)
        } else {
          views.setViewVisibility(R.id.goal_monthly_section, View.GONE)
          views.setViewVisibility(R.id.goal_add_monthly, View.VISIBLE)
        }

        if (hasCustomGoal) {
          val cg = data!!.customGoal!!
          val pct = if (cg.target > 0) (cg.saved / cg.target).coerceIn(0.0, 1.0) else 0.0
          views.setViewVisibility(R.id.goal_custom_section, View.VISIBLE)
          views.setViewVisibility(R.id.goal_add_custom, View.GONE)
          views.setTextViewText(R.id.goal_custom_name, cg.name)
          views.setTextViewText(R.id.goal_custom_saved, WidgetDataManager.fmt(cg.saved, sym))
          views.setTextViewText(R.id.goal_custom_target, "/ ${WidgetDataManager.fmt(cg.target, sym)}")
          views.setProgressBar(R.id.goal_custom_progress, 100, (pct * 100).toInt(), false)
        } else {
          views.setViewVisibility(R.id.goal_custom_section, View.GONE)
          views.setViewVisibility(R.id.goal_add_custom, View.VISIBLE)
        }
      }

      views.setOnClickPendingIntent(R.id.goal_root, pendingIntentForUri(ctx, "kachingo://budget"))
      mgr.updateAppWidget(id, views)
    }
  }
}
