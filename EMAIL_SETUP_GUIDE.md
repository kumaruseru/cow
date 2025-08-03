# 📧 EMAIL CONFIGURATION GUIDE - COW SOCIAL NETWORK

## 🚀 Quick Setup

### 1. Gmail Configuration (Recommended)

1. **Enable 2-Factor Authentication:**
   - Go to https://myaccount.google.com/security
   - Enable 2-Factor Authentication if not already enabled

2. **Generate App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and generate password
   - Copy the 16-character password (remove spaces)

3. **Update .env file:**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   ```

### 2. Alternative Email Providers

#### SendGrid
```env
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
```

#### Outlook/Hotmail
```env
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
```

#### Yahoo Mail
```env
EMAIL_USER=your-email@yahoo.com
EMAIL_PASS=your-app-password
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
```

## 🧪 Testing Email Configuration

Run the test script to verify your email setup:
```bash
node test-email-config.js
```

## 🔧 Troubleshooting

### Common Issues:

1. **"Invalid login" error:**
   - Make sure 2FA is enabled for Gmail
   - Use App Password, not your regular password
   - Remove spaces from App Password

2. **"Connection timeout" error:**
   - Check your internet connection
   - Verify SMTP host and port
   - Some networks block SMTP ports

3. **"Authentication failed" error:**
   - Double-check email credentials
   - Ensure "Less secure app access" is enabled for some providers

## 📋 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_USER` | SMTP username (usually your email) | `your-email@gmail.com` |
| `EMAIL_PASS` | SMTP password (App Password for Gmail) | `abcd efgh ijkl mnop` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `EMAIL_FROM` | "From" address in emails | `noreply@cow.social` |

## 🔐 Security Best Practices

1. **Never commit .env file to version control**
2. **Use App Passwords instead of account passwords**
3. **Rotate credentials regularly**
4. **Use dedicated email account for app notifications**
5. **Monitor email sending quotas**

## 📊 Email Quotas

### Gmail
- **Free accounts:** 500 emails/day
- **Google Workspace:** 2000-10000 emails/day

### SendGrid
- **Free tier:** 100 emails/day
- **Paid plans:** Higher limits available

### Outlook
- **Free accounts:** 300 emails/day
- **Paid accounts:** Higher limits

## 🚨 Production Considerations

1. **Use dedicated SMTP service (SendGrid, Mailgun, etc.)**
2. **Implement email queue for high volume**
3. **Add email analytics and tracking**
4. **Set up SPF, DKIM, and DMARC records**
5. **Monitor bounce rates and spam reports**

## 🔄 Switching from Test to Production

1. **Development Mode:** Uses Ethereal Email (fake SMTP)
   - No real emails sent
   - Preview URLs for testing

2. **Production Mode:** Uses configured SMTP
   - Real emails sent to users
   - Configure EMAIL_USER and EMAIL_PASS

The system automatically detects configuration and switches modes!
