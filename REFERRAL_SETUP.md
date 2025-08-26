# Referral System Setup Guide

## Setting Your Telegram Bot Username

The referral system needs to know your Telegram bot username to generate proper deep links.

### Option 1: Environment Variable (Recommended)

Create a `.env` file in your project root:

```env
# Your Telegram Bot Username (without @)
VITE_TELEGRAM_BOT_USERNAME=YourBotUsername

# Your Telegram Web App Short Name (set in BotFather)
VITE_TELEGRAM_SHORT_NAME=YourWebAppShortName
```

### Option 2: Update the Code

Edit `components/FriendsPanel.jsx` lines 11-12:

```javascript
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'YourBotUsername';
const SHORT_NAME = import.meta.env.VITE_TELEGRAM_SHORT_NAME || 'YourWebAppShortName';
```

## Referral Rewards Configuration

Current settings:
- **Invitee bonus**: 1,000 points (when they join)
- **Referrer bonus**: 1,000 points (when invitee places first bet)
- **Daily limit**: 10,000 points (10 referrals per day)

To change these values, update:
1. `backend/services/databaseService.js` - `attributeReferral()` and `markReferralActivated()` methods
2. `components/FriendsPanel.jsx` - UI text in "How It Works" section

## How Referral Links Work

Links follow this format:
```
https://t.me/YourBotUsername?start=ref_AV8R-XXXXX
```

Where:
- `YourBotUsername` is your bot's username
- `AV8R-XXXXX` is the user's unique referral code

## Testing Referrals

1. Get a referral link from the Friends tab
2. Open it in a different Telegram account
3. The new user should receive 1,000 points instantly
4. When they place their first bet, the referrer gets 1,000 points

## Fraud Prevention

The system includes:
- Self-referral prevention
- IP-based limiting (max 2 from same IP/day)
- Account age verification (< 7 days)
- Daily payout caps (10 referrals/day)
- Device fingerprinting
