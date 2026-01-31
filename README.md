# Stocks Analyser

This app will let you analyse stocks and tell you about the trending stocks in [1 week, 1 month, 1 year] time frame.
Also, in future let you mirror traders from famous portfolios like Pelosi tracker.

## Features

1. Show top trending stocks in the time frames mentioned above, [1 week, 1 month, 6 months, 1 year, 5 years].
2. Plot graphs to show trends in stock prices

## Architecture

[Weekly/ Daily Stocks API] ––{cron job}––> [Raw Stock Prices DB] ––{cron job}––> [Updated Stock Prices DB] ––{Django REST API}––> WebUI

1. Many stocks go under stock splits which shows up when checking min/ max values
2. For eg. Netflix went under stock split, with ratio: 10-for-1 (10 new shares for every 1 owned). Effective Date: November 17, 2025. Historic context, this was the third stock split in Netflix's history, following a 7-for-1 split in 2015 and a 2-for-1 split in 2004.
3. So this would show up as Netflix stock went from 1100 to 110 an 10x decrease in price overnight on Nov 17. Making Netflix stock in the bottom performing stock in SNP 500, other companies that went through this forward stock split were (NOW) Servicenow Inc. Forward 5-for-1 on Dec 18, 2025.
4. Companies can also go for backward stock split, which would mean that for a 1-for-5 stock split at 100, would make the stock worth 500. This would indicate that the stock is the best performing stock.
