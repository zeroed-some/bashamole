# Generated by Django 5.2.3 on 2025-06-16 02:57

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("trees", "0005_filesystemtree_moles_killed_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="filesystemtree",
            name="current_mole_timer",
            field=models.IntegerField(default=60),
        ),
        migrations.AddField(
            model_name="filesystemtree",
            name="default_mole_timer",
            field=models.IntegerField(default=60),
        ),
        migrations.AddField(
            model_name="filesystemtree",
            name="mole_spawned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="filesystemtree",
            name="timer_expired_count",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="filesystemtree",
            name="timer_paused",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="gamesession",
            name="average_kill_time",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="gamesession",
            name="fastest_kill_time",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="gamesession",
            name="moles_escaped",
            field=models.IntegerField(default=0),
        ),
    ]
