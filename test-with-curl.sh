#!/bin/bash

# Test script using curl to bypass frontend issues
# You need to get a valid token first

echo "🔍 Testing Player Settings API with curl..."

# IMPORTANT: Replace this with an actual token
# You can get this by:
# 1. Opening your game directly at https://aviator-game-topaz.vercel.app
# 2. Logging in
# 3. Running: localStorage.getItem('auth_token') in the console
TOKEN="YOUR_TOKEN_HERE"

if [ "$TOKEN" = "YOUR_TOKEN_HERE" ]; then
    echo "❌ Please replace YOUR_TOKEN_HERE with an actual token"
    echo "Get it by:"
    echo "1. Open https://aviator-game-topaz.vercel.app in a browser"
    echo "2. Log in to the game"
    echo "3. Open console and run: localStorage.getItem('auth_token')"
    exit 1
fi

echo "📡 Testing PUT /api/player/settings..."
curl -i -X PUT https://aviator-game-production.up.railway.app/api/player/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"autoCashoutEnabled":true,"autoCashoutMultiplier":1.8,"soundEnabled":false}'

echo -e "\n\n📡 Testing GET /api/player/settings..."
curl -i -X GET https://aviator-game-production.up.railway.app/api/player/settings \
  -H "Authorization: Bearer $TOKEN"
