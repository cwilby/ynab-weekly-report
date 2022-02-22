# YNAB Weekly Report

A script that sends a weekly email with a breakdown of category group data in [YNAB](https://ynab.com/referral/?ref=mdM-gKG7KyDRwN1B).

## Getting Started

Create a `.env` file or copy `.env.example` and add values for the following configuration keys:

```
YNAB_ACCESS_TOKEN=<Create an access token in YNAB>
YNAB_BUDGET_ID=<The budget to create a report from>

EMAIL_RECIPIENTS=foo@example.com, bar@example.com

SMTP_FROM="YNAB Weekly Report <noreply@example.com>"
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

Then, run `docker-compose up -d` - an email will now be sent to `EMAIL_RECIPIENTS` every Monday at 10am.