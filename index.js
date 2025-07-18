require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const pLimit = require('p-limit');

const config = {
  accountName: process.env.VTEX_ACCOUNT_NAME,
  appKey: process.env.VTEX_APP_KEY,
  appToken: process.env.VTEX_APP_TOKEN,
  csvFilePath: process.env.CSV_FILE_PATH || './data.csv',
  rateLimit: parseInt(process.env.RATE_LIMIT) || 2
};

const limit = pLimit(config.rateLimit);
const baseURL = `https://${config.accountName}.vtexcommercestable.com.br/api`;

function validateConfig() {
  if (!config.accountName || !config.appKey || !config.appToken) {
    throw new Error('Missing required environment variables. Check your .env file.');
  }
  
  if (!fs.existsSync(config.csvFilePath)) {
    throw new Error(`CSV file not found: ${config.csvFilePath}`);
  }
}

function parsePrice(priceString) {
  if (!priceString) return null;
  
  const cleanPrice = priceString
    .replace(/[\$\s,]/g, '')
    .replace(/\./g, '');
  
  const price = parseInt(cleanPrice);
  return isNaN(price) ? null : price;
}

function readCSV() {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(config.csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const sku = row['Parte'];
        const priceString = row[' Precio Base.'] || row['Precio Base.'] || row['Precio Base'];
        const basePrice = parsePrice(priceString);
        
        if (sku && basePrice !== null) {
          results.push({
            itemId: sku,
            basePrice: basePrice
          });
        }
      })
      .on('end', () => {
        console.log(`📊 Found ${results.length} products to update`);
        resolve(results);
      })
      .on('error', reject);
  });
}

async function updatePrice(itemId, basePrice) {
  try {
    const url = `${baseURL}/pricing/prices/${itemId}`;
    
    const priceData = {
      itemId: itemId,
      basePrice: basePrice,
      costPrice: null,
      markup: null,
      fixedPrices: []
    };

    const response = await axios.put(url, priceData, {
      headers: {
        'X-VTEX-API-AppKey': config.appKey,
        'X-VTEX-API-AppToken': config.appToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return {
      success: true,
      itemId,
      basePrice,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      itemId,
      basePrice,
      error: error.response?.data || error.message
    };
  }
}

async function updatePrices() {
  try {
    console.log('🚀 Starting VTEX price update process...');
    
    validateConfig();
    
    const products = await readCSV();
    
    if (products.length === 0) {
      console.log('❌ No valid products found in CSV');
      return;
    }

    console.log(`📈 Updating ${products.length} prices with rate limit of ${config.rateLimit} requests/second`);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    const promises = products.map((product, index) => 
      limit(async () => {
        const result = await updatePrice(product.itemId, product.basePrice);
        
        if (result.success) {
          results.successful++;
          console.log(`✅ [${index + 1}/${products.length}] Updated ${product.itemId}: $${product.basePrice}`);
        } else {
          results.failed++;
          results.errors.push(result);
          console.log(`❌ [${index + 1}/${products.length}] Failed ${product.itemId}: ${result.error}`);
        }
        
        return result;
      })
    );

    await Promise.all(promises);

    console.log('\n📊 Update Summary:');
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\n🔍 Failed Updates:');
      results.errors.forEach(error => {
        console.log(`- ${error.itemId}: ${error.error}`);
      });
    }

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

(async () => {
  try {
    await updatePrices();
    console.log('🎉 Process completed successfully!');
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
})();