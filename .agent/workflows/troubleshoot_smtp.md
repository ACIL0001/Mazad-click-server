---
description: Troubleshoot SMTP Configuration on Render
---
1. Go to your Render Dashboard.
2. Select your `mazadclick-server` (or similarly named web service).
3. Click on the **Environment** tab.
4. Verify the following variables are set correctly:
   - `SMTP_HOST`: `mail.mazadclick.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `dev@mazadclick.com`
   - `SMTP_PASSWORD`: (Verify this matches what you used locally)
   - `SMTP_FROM`: `"MazadClick" <dev@mazadclick.com>`
   - `ENABLE_REAL_EMAIL`: `true`
5. If variables are missing, add them and redeploy.
6. Check the **Logs** tab after redeployment. Look for:
   - `SMTP Transporter initialized: Host=mail.mazadclick.com...`
   - If sending fails, look for `SMTP Error Code:` or `SMTP Response:` which will now appear in the logs due to our recent changes.
7. If timeouts persist, consider using a different SMTP provider (e.g., SendGrid, Mailgun) as `mail.mazadclick.com` might be blocking Render's IP addresses.
