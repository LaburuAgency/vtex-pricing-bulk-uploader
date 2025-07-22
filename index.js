require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const { default: pLimit } = require('p-limit');

const config = {
  accountName: process.env.VTEX_ACCOUNT_NAME,
  appKey: process.env.VTEX_APP_KEY,
  appToken: process.env.VTEX_APP_TOKEN,
  csvFilePath: process.env.CSV_FILE_PATH || './data.csv',
  rateLimit: parseInt(process.env.RATE_LIMIT) || 2
};

console.table(config);

const limit = pLimit(config.rateLimit);
const baseURL = `https://api.vtex.com/${config.accountName}`;
const catalogURL = `https://${config.accountName}.vtexcommercestable.com.br/api`;

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
  
  const cleanPrice = priceString.replace(/[\$\s,]/g, '').trim();
  
  const price = parseFloat(cleanPrice);
  if (isNaN(price)) return null;
  
  return price
}

async function getSkuIdFromRefId(refId) {
  try {
    const url = `${catalogURL}/catalog_system/pvt/sku/stockkeepingunitidbyrefid/${refId}`;
    
    const response = await axios.get(url, {
      headers: {
        'X-VTEX-API-AppKey': config.appKey,
        'X-VTEX-API-AppToken': config.appToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data) {
      // VTEX devuelve directamente el SKU ID en este endpoint
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`❌ Error getting SKU ID for RefId ${refId}:`, error.response?.data || error.message);
    return null;
  }
}

async function readCSV() {
  return new Promise((resolve, reject) => {
    const rawResults = [];
    
    fs.createReadStream(config.csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const refId = row['Parte'];
        const priceString = row[' Precio Base.'] || row['Precio Base.'] || row['Precio Base'];
        const basePrice = parsePrice(priceString);
        
        if (refId && basePrice !== null) {
          rawResults.push({
            refId: refId,
            basePrice: basePrice
          });
        }
      })
      .on('end', async () => {
        // Process all products
        const limitedResults = rawResults;
        
        console.log(`📊 Found ${limitedResults.length} products with Reference IDs`);
        console.log(`🔄 Converting Reference IDs to SKU IDs...`);
        
        try {
          const results = [];
          const failedRefIds = [];
          
          // Process with rate limiting
          const promises = limitedResults.map((item, index) => 
            limit(async () => {
              const skuId = await getSkuIdFromRefId(item.refId);
              console.log(`🔄 RefId ${item.refId} → SKU ID ${skuId}`);
              
              if (skuId) {
                console.log(`✅ [${index + 1}/${limitedResults.length}] RefId ${item.refId} → SKU ID ${skuId}`);
                results.push({
                  itemId: skuId,
                  refId: item.refId,
                  basePrice: item.basePrice
                });
              } else {
                console.log(`❌ [${index + 1}/${limitedResults.length}] Could not find SKU ID for RefId ${item.refId}`);
                failedRefIds.push({
                  refId: item.refId,
                  basePrice: item.basePrice,
                  timestamp: new Date().toISOString()
                });
              }
            })
          );
          
          await Promise.all(promises);
          
          // Write failed RefIds to log file
          if (failedRefIds.length > 0) {
            const logContent = failedRefIds.map(item => 
              `${item.timestamp}\t${item.refId}\t${item.basePrice}`
            ).join('\n');
            
            const logHeader = 'Timestamp\tRefId\tPrice\n';
            const logPath = './failed-refids.log';
            
            try {
              fs.writeFileSync(logPath, logHeader + logContent);
              console.log(`📋 Saved ${failedRefIds.length} failed RefIds to ${logPath}`);
            } catch (error) {
              console.error('❌ Failed to write log file:', error.message);
            }
          }
          
          console.log(`📊 Successfully converted ${results.length} products`);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function updatePrice(itemId, basePrice) {
  try {
    const url = `${baseURL}/pricing/prices/${itemId}`;
    
    const priceData = {
      basePrice: basePrice,
      costPrice: basePrice
    };

    const response = await axios.put(url, priceData, {
      headers: {
        'X-VTEX-API-AppKey': config.appKey,
        'X-VTEX-API-AppToken': config.appToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return { success: true, itemId, basePrice, status: response.status };
  } catch (error) { return { success: false, itemId, basePrice, error: error.response?.data || error.message }; }
} async function updatePrices() {
  try {
    console.log('🚀 Starting VTEX price update process...');
    validateConfig();
    const products = await readCSV();
    if (products.length === 0) {
      console.log('❌ No valid products found in CSV');
      return;
    } 
    console.log(`📈 Updating ${products.length} prices with rate limit of ${config.rateLimit} requests/second`); const results = { successful: 0, failed: 0, errors: [] };

    const promises = products.map((product, index) =>
      limit(async () => {
        const result = await updatePrice(product.itemId, product.basePrice);

        if (result.success) {
          results.successful++;
          console.log(`✅ [${index + 1}/${products.length}] Updated SKU ID ${product.itemId} (RefId: ${product.refId}): $${product.basePrice}`);
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