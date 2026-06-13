package com.kachingo.myapp.widget

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

fun pendingIntentForUri(ctx: Context, uri: String): PendingIntent {
  val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    setPackage(ctx.packageName)
  }
  val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  else PendingIntent.FLAG_UPDATE_CURRENT
  return PendingIntent.getActivity(ctx, uri.hashCode(), intent, flags)
}
