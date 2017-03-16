# -*- coding: utf-8 -*-
# Generated by Django 1.9 on 2017-02-03 12:08
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('options', '0007_meta'),
    ]

    operations = [
        migrations.AddField(
            model_name='option',
            name='path',
            field=models.SlugField(blank=True, help_text='The path part of the URI for this option.', max_length=512, null=True, verbose_name='Path'),
        ),
    ]