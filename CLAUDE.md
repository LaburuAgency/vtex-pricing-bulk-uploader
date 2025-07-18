# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VTEX pricing bulk uploader tool that reads product pricing data from CSV files and updates prices through the VTEX Commerce API. The application is designed for bulk price updates with rate limiting to avoid API throttling.

## Key Commands

- `npm start` or `npm run dev` - Run the price update process
- `node index.js` - Direct execution of the main script

## Architecture

The application is a single-file Node.js script (`index.js`) with the following key components:

### Core Functions
- `validateConfig()` - Validates environment variables and file existence (index.js:18)
- `parsePrice(priceString)` - Converts price strings to integers for VTEX API (index.js:28)
- `readCSV()` - Parses CSV data and extracts SKUs and prices (index.js:39)
- `updatePrice(itemId, basePrice)` - Makes API calls to update individual prices (index.js:65)
- `updatePrices()` - Main orchestration function with rate limiting (index.js:102)

### Rate Limiting
Uses `p-limit` library to control concurrent API requests. Default is 2 requests/second, configurable via `RATE_LIMIT` environment variable.

### CSV Data Structure
Expected CSV columns:
- `Parte` - SKU/Item ID
- ` Precio Base.` or `Precio Base.` or `Precio Base` - Price column (handles variations in spacing)

### VTEX API Integration
- Endpoint: `https://{account}.vtexcommercestable.com.br/api/pricing/prices/{itemId}`
- Authentication: X-VTEX-API-AppKey and X-VTEX-API-AppToken headers
- Price format: Integer values (dollars are converted to cents)

## Environment Configuration

Required environment variables (see `.env.example`):
- `VTEX_ACCOUNT_NAME` - VTEX account identifier
- `VTEX_APP_KEY` - API authentication key
- `VTEX_APP_TOKEN` - API authentication token
- `CSV_FILE_PATH` - Path to CSV file (default: ./data.csv)
- `RATE_LIMIT` - Requests per second (default: 2)

## Error Handling

The application includes comprehensive error handling:
- Configuration validation before execution
- Individual price update error tracking
- Summary reporting of successful vs failed updates
- Graceful handling of malformed price data