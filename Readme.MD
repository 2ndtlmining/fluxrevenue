# Flux Revenue Tracker

A comprehensive terminal-style dashboard for tracking Flux cryptocurrency revenue, network statistics, and blockchain synchronization. Built with SvelteKit and designed with an authentic terminal aesthetic.

## 🌟 Features

### Revenue Tracking
- **Real-time Balance Monitoring**: Track current FLUX balance across multiple addresses
- **Historical Revenue Analytics**: View revenue data by day, week, month, and year
- **Transaction Log**: Detailed transaction history with pagination and search
- **Multi-Address Support**: Track revenue across multiple FLUX addresses simultaneously
- **Currency Toggle**: Switch between FLUX and USD display (with real-time price data)

### Network Monitoring
- **Node Statistics**: Real-time monitoring of Cumulus, Nimbus, Stratus, and ArcaneOS nodes
- **Network Utilization**: CPU, RAM, and SSD usage across the network
- **Resource Visualization**: ASCII-style progress bars and terminal-themed displays
- **Running Applications**: Track deployed applications and Watchtower instances

### Blockchain Synchronization
- **Smart Sync Engine**: Optimized hybrid sync (forward + backward) with parallel processing
- **Progress Tracking**: Real-time sync status with ETA calculations
- **Block-based Analytics**: Revenue calculations based on actual block counts rather than time
- **Data Retention**: Configurable retention periods with automatic cleanup

### Analytics & Visualization
- **Interactive Charts**: SVG-based charts with multiple data sources and metrics
- **Terminal Interface**: Authentic command-line aesthetic with ASCII art
- **Export Functionality**: CSV export for all data types
- **Real-time Updates**: WebSocket-style updates with caching for performance

## 📊 Revenue Calculations

The tracker uses sophisticated calculation methods to ensure accuracy:

### Block-Based Revenue Periods
Instead of using calendar time, revenue is calculated based on actual blockchain blocks:

- **Daily Revenue**: Last 720 blocks (~24 hours)
- **Weekly Revenue**: Last 5,040 blocks (~7 days)  
- **Monthly Revenue**: Last 21,600 blocks (~30 days)
- **Yearly Revenue**: Last 262,800 blocks (~365 days)

This approach accounts for actual network timing rather than calendar time, providing more accurate revenue tracking.

### Multi-Address Aggregation
When tracking multiple addresses:
- Individual address breakdowns with separate totals
- Combined view showing aggregate revenue across all addresses
- Address-specific transaction filtering and analysis
- Automatic detection and tracking of new addresses

### Price Integration
- Real-time FLUX/USD price fetching from multiple API sources
- Automatic fallback to secondary price APIs if primary fails
- Configurable update intervals and caching
- Currency conversion with proper decimal precision

### Transaction Analysis
- **From Address Resolution**: Automatically resolves sender addresses from previous transactions
- **Block Height Tracking**: All transactions linked to specific block heights
- **Duplicate Prevention**: UNIQUE constraints prevent duplicate transaction entries
- **Data Validation**: Comprehensive validation of all incoming transaction data

## ⚙️ Configuration (config.js)

The application is highly configurable through the `config.js` file:

### Target Addresses
```javascript
export const TARGET_ADDRESSES = [
  'your_flux_address_1',
  'your_flux_address_2',
  // Add more addresses as needed
];
```
### Sync Configuration
```javascript
export const SYNC_CONFIG = {
  BLOCKS_PER_DAY: 720,                        // Expected blocks per day
  RETENTION_DAYS: 30,                         // Days of data to keep
  MAX_BLOCKS_PER_SYNC: 2000,                 // Max blocks per sync cycle
  SYNC_INTERVAL: 5 * 60 * 1000,              // Sync frequency (5 minutes)
  PARALLEL_BATCHES: 8,                        // Parallel processing batches
  BATCH_SIZE: 50,                             // Blocks per batch
  ENABLE_FAST_SYNC: true                      // Enable optimized sync
};
```

### Database Configuration
```javascript
export const DB_CONFIG = {
  DB_NAME: 'flux-tracker.db',                 // SQLite database file
  ENABLE_WAL_MODE: true,                      // Enable WAL mode for performance
  BATCH_INSERT_SIZE: 200,                     // Batch insert size
  OPTIMIZE_INDEXES: true,                     // Create performance indexes
  ENABLE_AUTO_MAINTENANCE: true              // Automatic database maintenance
};
```

### Revenue Configuration
```javascript
const REVENUE_CONFIG = {
  updateInterval: 2 * 60 * 1000,             // Update every 2 minutes
  enableCache: true,                         // Enable revenue caching
  cacheDuration: 60 * 1000,                  // Cache for 1 minute
  blockPeriods: {                            // Block-based periods
    day: 720,        // ~24 hours
    week: 5040,      // ~7 days  
    month: 21600,    // ~30 days
    year: 262800     // ~365 days
  }
};
```

### UI Configuration
```javascript
const UI_CONFIG = {
  defaultCurrency: 'FLUX',                   // Default currency display
  enableCurrencyToggle: true,                // Allow USD/FLUX toggle
  theme: 'terminal',                         // Terminal theme
  refreshInterval: 30000,                    // UI refresh rate
  maxTransactionsDisplay: 100                // Max transactions per page
};
```

### Performance Configuration
```javascript
export const PERFORMANCE_CONFIG = {
  ENABLE_METRICS: true,                      // Enable performance tracking
  LOG_PRICE_UPDATES: true,                   // Log price API calls
  LOG_REVENUE_UPDATES: true,                 // Log revenue calculations
  MAX_CACHE_SIZE: 1000,                      // Maximum cache entries
  ENABLE_COMPRESSION: true                   // Enable data compression
};
```

### Network Stats Configuration
```javascript
const NETWORK_STATS_CONFIG = {
  enableNodeStats: true,                     // Track node statistics
  enableUtilizationStats: true,             // Track resource utilization
  snapshotInterval: 12 * 60 * 60 * 1000,   // Snapshot every 12 hours
  retentionPeriod: 365 * 24 * 60 * 60 * 1000, // Keep 1 year of data
  apiTimeout: 15000                          // Network API timeout
};
```

## 🚀 Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/2ndtlmining/fluxrevenue
   cd fluxrevenue
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Your Addresses**
   Edit `src/lib/config.js` and add your FLUX addresses:
   ```javascript
   export const TARGET_ADDRESSES = [
     'your_flux_tracking_address',
     '........',
   ];
   ```

4. **Start the Application**
   ```bash
   npm run dev
   ```

5. **Access the Dashboard**
   Open your browser to `http://localhost:5173`

## 🔧 Advanced Configuration

### Custom Block Periods
Adjust revenue calculation periods based on your needs:
```javascript
blockPeriods: {
  custom1: 360,   // ~12 hours
  custom2: 1440,  // ~2 days
  custom3: 10080  // ~2 weeks
}


### Database Optimization
For high-volume tracking:
```javascript
export const DB_CONFIG = {
  ENABLE_WAL_MODE: true,     // Better concurrency
  BATCH_INSERT_SIZE: 500,    // Larger batches
  OPTIMIZE_INDEXES: true,    // Performance indexes
  cache_size: 32768         // 128MB cache
};
```

## 📈 Performance Features

- **Parallel Processing**: Multi-threaded block analysis with configurable concurrency
- **Smart Caching**: Intelligent caching of API responses and calculations
- **Database Optimization**: WAL mode, optimized indexes, and batch operations
- **Memory Management**: Automatic cleanup and garbage collection
- **Network Optimization**: Request batching and retry logic with exponential backoff

## 🎨 Terminal Aesthetic

The interface features an authentic terminal design:
- **ASCII Art Logo**: Animated FLUX logo with terminal styling
- **Monospace Fonts**: JetBrains Mono for authentic terminal feel
- **Color Scheme**: Authentic terminal colors with ANSI-style highlighting
- **Progress Bars**: ASCII-style progress indicators (█▓▒░)
- **Terminal Commands**: Interactive command-line style controls

## 📊 Data Export

Export functionality for all data types:
- **Revenue Data**: CSV export with configurable date ranges
- **Transaction History**: Complete transaction logs with search/filter
- **Network Statistics**: Historical node and utilization data
- **Performance Metrics**: Sync performance and API statistics

## 🔐 Security Features

- **Input Validation**: Comprehensive validation of all user inputs
- **API Security**: Rate limiting and request validation
- **Data Integrity**: Transaction uniqueness constraints and validation
- **Error Handling**: Graceful handling of API failures and network issues

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

This project is open source. Please check the repository for license details.

## 🙏 Support

If you find this tool useful, consider donating FLUX to support development:
```
t1ebxupkNYVQiswfwi7xBTwwKtioJqwLmUG
```

---

**Built with ❤️ for the Flux community**