# Identity Mirror Chrome Extension

Generate replies in your identity voice directly inside Gmail.

## Setup Instructions

### 1. Create Extension Token

1. Go to your Identity Mirror website
2. Navigate to **Account** → **Extension Tokens**
3. Click **"Create Token"**
4. **Copy the token immediately** (it's only shown once)
   - Format: `userId.secret` (e.g., `abc123.xyz789`)

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select the `extension/` folder from this repository
5. Extension should appear in your extensions list

### 3. Configure Extension

1. Click the **Identity Mirror extension icon** in Chrome toolbar
2. Popup opens:
   - **API Base URL**: Enter your backend URL
     - Development: `http://localhost:3000`
     - Production: `https://yourdomain.com`
   - **Bearer Token**: Paste the token you copied in step 1
3. Click **"Save"**
4. Click **"Test Connection"** to verify:
   - Should show: `Connected: [Your Name]`
   - If error: Check token and API URL

### 4. Use in Gmail

1. Open Gmail (`https://mail.google.com`)
2. Open an email thread (with 2-3 messages)
3. Click **"Reply"** or **"Compose"**
4. In the compose toolbar, you'll see a **"Mirror"** button
5. Click **"Mirror"**:
   - Extension extracts thread text automatically
   - Modal shows decision + suggested reply
   - Click **"Insert"** to add reply to compose box
   - Click **"This is me"** or **"Not me"** to provide feedback

## Troubleshooting

### "Couldn't extract the thread"
- Make sure you're viewing an email thread (not just inbox)
- Try refreshing Gmail page
- Ensure you have at least 1-2 messages in the thread

### "No token set"
- Open extension popup
- Paste token in "Bearer Token" field
- Click "Save"

### "Failed: HTTP 401"
- Token might be revoked or expired
- Create a new token on website
- Update token in extension popup

### "Failed: HTTP 404"
- Check API Base URL is correct
- Ensure backend is running (for localhost)
- Verify backend domain is correct (for production)

### Mirror button not appearing
- Refresh Gmail page
- Check extension is enabled in `chrome://extensions`
- Try reloading extension (click reload icon)

### Insert not working
- Try clicking "Insert" again
- Manually paste reply if needed
- Check browser console for errors (F12)

## Development

### Local Development
- Set API Base URL to `http://localhost:3000`
- Ensure backend is running on port 3000
- Use development token from local backend

### Production
- Update `manifest.json` `host_permissions` to remove `localhost`
- Set API Base URL to production domain
- Use production token from website

## File Structure

```
extension/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js     # Background worker
├── content/
│   └── gmail-inject.js       # Gmail DOM injection
├── popup/
│   ├── popup.html            # Settings UI
│   └── popup.js              # Popup logic
├── styles/
│   └── modal.css             # Modal styling
├── utils/
│   └── api.js                # API helpers
└── icons/                    # Extension icons (16x16, 48x48, 128x128)
```

## Security Notes

- Tokens are stored in `chrome.storage.local` (encrypted by Chrome)
- Never share your extension token
- Revoke tokens if compromised (Account → Extension Tokens)
- API Base URL is validated (only localhost or yourdomain.com allowed)

## Support

For issues or questions:
- Check backend logs for API errors
- Verify token is active (not revoked)
- Ensure identity is configured on website


