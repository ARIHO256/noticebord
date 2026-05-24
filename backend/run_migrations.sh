#!/bin/bash
# Script to run database migrations

cd "$(dirname "$0")"

echo "Running database migrations..."
python manage.py makemigrations
python manage.py migrate

echo "Migrations completed!"



