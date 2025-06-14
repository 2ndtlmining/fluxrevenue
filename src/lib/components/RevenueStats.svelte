<script>
  import { onMount } from 'svelte';
  import { 
    getPriceApiConfig, 
    getRevenueConfig, 
    getDefaultCurrency, 
    isCurrencyToggleEnabled,
    PERFORMANCE_CONFIG 
  } from '$lib/config.js';
  
  export let stats = {
    currentBalance: 0,
    totalRevenue: 0,
    totalTransactions: 0
  };
  export let transactions = []; // Add transactions prop
  export let selectedAddress = 'all'; // Add prop for address selection
  
  // Get configuration
  const priceConfig = getPriceApiConfig();
  const revenueConfig = getRevenueConfig();
  const defaultCurrency = getDefaultCurrency();
  const currencyToggleEnabled = isCurrencyToggleEnabled();
  
  // State for price and currency toggle
  let fluxPrice = 0;
  let showUSD = defaultCurrency === 'USD'; // Use config default
  let priceLoading = false;
  let priceError = false;
  let priceCache = null;
  let priceCacheTime = 0;
  
  // State for block-based revenue data
  let blockRevenueData = {
    day: 0,      // 720 blocks
    week: 0,     // 5040 blocks  
    month: 0,    // 21600 blocks
    year: 0      // 262800 blocks
  };
  let blockRevenueLoading = true;
  let revenueCache = new Map();
  
  // Intervals for cleanup
  let priceInterval;
  let revenueInterval;
  
  // Fetch FLUX price on mount and periodically
  onMount(async () => {
    await fetchFluxPrice();
    await fetchBlockRevenue();
    
    // Set up intervals using config
    priceInterval = setInterval(fetchFluxPrice, priceConfig.updateInterval);
    revenueInterval = setInterval(fetchBlockRevenue, revenueConfig.updateInterval);
    
    // Cleanup intervals on component destroy
    return () => {
      if (priceInterval) clearInterval(priceInterval);
      if (revenueInterval) clearInterval(revenueInterval);
    };
  });
  
  // Watch for address changes to refetch block revenue
  $: if (selectedAddress !== undefined) {
    fetchBlockRevenue();
  }
  
  async function fetchFluxPrice() {
    try {
      priceLoading = true;
      priceError = false;
      
      // Check cache first
      if (priceConfig.enableCache && priceCache && 
          (Date.now() - priceCacheTime) < priceConfig.cacheDuration) {
        fluxPrice = priceCache;
        if (PERFORMANCE_CONFIG.LOG_PRICE_UPDATES) {
          console.log('💰 FLUX price from cache:', fluxPrice);
        }
        return;
      }
      
      let success = false;
      let lastError;
      
      // Try main API first
      for (let attempt = 0; attempt < priceConfig.retryAttempts; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), priceConfig.timeout);
          
          const response = await fetch(priceConfig.url, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const data = await response.json();
          const newPrice = data.data?.rate || 0;
          
          if (newPrice > 0) {
            fluxPrice = newPrice;
            priceCache = newPrice;
            priceCacheTime = Date.now();
            success = true;
            
            if (PERFORMANCE_CONFIG.LOG_PRICE_UPDATES) {
              console.log(`💰 FLUX price updated (attempt ${attempt + 1}):`, fluxPrice);
            }
            break;
          }
        } catch (error) {
          lastError = error;
          if (attempt < priceConfig.retryAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, priceConfig.retryDelay));
          }
        }
      }
      
      // Try fallback APIs if main failed
      if (!success && priceConfig.fallbackApis.length > 0) {
        for (const fallbackUrl of priceConfig.fallbackApis) {
          try {
            const response = await fetch(fallbackUrl, {
              signal: AbortSignal.timeout(priceConfig.timeout)
            });
            
            if (response.ok) {
              const data = await response.json();
              // Handle different API response formats
              let newPrice = 0;
              if (data.flux && data.flux.usd) {
                newPrice = data.flux.usd; // CoinGecko format
              }
              
              if (newPrice > 0) {
                fluxPrice = newPrice;
                priceCache = newPrice;
                priceCacheTime = Date.now();
                success = true;
                console.log('💰 FLUX price updated from fallback API:', fluxPrice);
                break;
              }
            }
          } catch (error) {
            console.warn('Fallback price API failed:', error.message);
          }
        }
      }
      
      if (!success) {
        throw lastError || new Error('All price APIs failed');
      }
      
    } catch (error) {
      console.error('Error fetching FLUX price:', error);
      priceError = true;
    } finally {
      priceLoading = false;
    }
  }
  
  async function fetchBlockRevenue() {
    try {
      blockRevenueLoading = true;
      
      // Use configured block periods
      const periods = revenueConfig.blockPeriods;
      
      // Fetch revenue data for each period
      const results = {};
      
      for (const [period, blocks] of Object.entries(periods)) {
        try {
          // Check cache first
          const cacheKey = `${period}-${selectedAddress}-${blocks}`;
          if (revenueConfig.enableCache && revenueCache.has(cacheKey)) {
            const cached = revenueCache.get(cacheKey);
            if ((Date.now() - cached.timestamp) < revenueConfig.cacheDuration) {
              results[period] = cached.value;
              continue;
            }
          }
          
          const params = new URLSearchParams({
            blocks: blocks.toString()
          });
          
          // Add address parameter if not 'all'
          if (selectedAddress && selectedAddress !== 'all') {
            params.set('address', selectedAddress);
          }
          
          const response = await fetch(`/api/revenue-blocks?${params}`);
          if (response.ok) {
            const data = await response.json();
            const revenue = data.total_revenue || 0;
            results[period] = revenue;
            
            // Cache the result
            if (revenueConfig.enableCache) {
              revenueCache.set(cacheKey, {
                value: revenue,
                timestamp: Date.now()
              });
            }
          } else {
            console.error(`Failed to fetch ${period} revenue:`, response.status);
            results[period] = 0;
          }
        } catch (error) {
          console.error(`Error fetching ${period} revenue:`, error);
          results[period] = 0;
        }
      }
      
      blockRevenueData = results;
      
      if (PERFORMANCE_CONFIG.LOG_REVENUE_UPDATES) {
        console.log('📊 Block revenue data updated:', blockRevenueData);
      }
      
    } catch (error) {
      console.error('Error fetching block revenue:', error);
    } finally {
      blockRevenueLoading = false;
    }
  }
  
  // Calculate last payment from transactions
  $: lastPayment = (() => {
    if (!transactions || transactions.length === 0) {
      return { amount: 0, date: null };
    }
    
    // Sort transactions by date (most recent first)
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    const lastTransaction = sortedTransactions[0];
    return {
      amount: lastTransaction.amount || 0,
      date: lastTransaction.date
    };
  })();

  function formatNumber(num, isPrice = false) {
    if (!num && num !== 0) return '0.00000000';
    
    if (isPrice) {
      // Format as currency with appropriate decimals
      if (num >= 1) return num.toFixed(4);
      return num.toFixed(6);
    }
    
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(8);
  }
  
  // FIXED: Currency formatting function with immediate reactivity
  $: formatCurrency = (fluxAmount) => {
    if (!showUSD || !fluxPrice || fluxPrice <= 0) {
      // Show FLUX format without $ sign
      return formatNumber(fluxAmount);
    }
    
    // Convert FLUX to USD and format with $ sign
    const usdValue = fluxAmount * fluxPrice;
    if (usdValue >= 1000000) return `${(usdValue / 1000000).toFixed(2)}M`;
    if (usdValue >= 1000) return `${(usdValue / 1000).toFixed(2)}K`;
    if (usdValue >= 1) return `${usdValue.toFixed(2)}`;
    return `${usdValue.toFixed(4)}`;
  };
  
  // FIXED: Currency unit helper function with immediate reactivity
  $: getCurrencyUnit = () => {
    return showUSD && fluxPrice && fluxPrice > 0 ? 'USD' : 'FLUX';
  };

  function formatDate(dateString) {
    if (!dateString) return 'No payments yet';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString();
  }
  
  function toggleCurrency() {
    if (currencyToggleEnabled) {
      showUSD = !showUSD;
    }
  }
</script>

<div class="flux-panel">
  <div class="panel-header">
    <span>Revenue Metrics</span>
    <span style="font-size: 12px; color: rgba(255,255,255,0.7);">Last Update: 2 min ago</span>
  </div>
  <div class="panel-content">
    <!-- System Status Row -->
    <div class="metrics-row">
      <div class="metric-group">
        <div class="metric">
          <span class="metric-label">Status:</span>
          <span class="metric-value online">●</span>
        </div>
        <div class="metric">
          <span class="metric-label">MainPid:</span>
          <span class="metric-value">2152</span>
        </div>
      </div>
      <div class="metric-group">
        <!-- Currency Toggle -->
        {#if currencyToggleEnabled}
          <div class="currency-toggle">
            <button 
              class="toggle-btn" 
              class:active={!showUSD}
              on:click={toggleCurrency}
              disabled={priceLoading || priceError}
            >
              FLUX
            </button>
            <button 
              class="toggle-btn" 
              class:active={showUSD}
              on:click={toggleCurrency}
              disabled={priceLoading || priceError || !fluxPrice}
            >
              USD
            </button>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Price Display Row -->
    {#if fluxPrice > 0}
      <div class="metrics-row">
        <div class="metric">
          <span class="metric-label">FLUX Price:</span>
          <span class="metric-value price-value">${formatNumber(fluxPrice, true)}</span>
          <span class="price-status" class:error={priceError}>
            {priceLoading ? '↻' : priceError ? '⚠' : '✓'}
          </span>
        </div>
      </div>
    {/if}
    
    <!-- Revenue Stats Grid -->
    <div class="stats-grid">
      <!-- Current Balance -->
      <div class="stat-item balance">
        <div class="stat-value">{formatCurrency(stats.currentBalance)}</div>
        <div class="stat-label">Available Balance</div>
        <div class="stat-unit">{getCurrencyUnit()}</div>
      </div>

      <!-- Last Payment -->
      <div class="stat-item last-payment">
        <div class="stat-value">{formatCurrency(lastPayment.amount || 0)}</div>
        <div class="stat-label">Last Payment</div>
        <div class="stat-unit">{getCurrencyUnit()}</div>
      </div>

      <!-- Total Transactions -->
      <div class="stat-item transactions">
        <div class="stat-value">{stats.totalTransactions}</div>
        <div class="stat-label">Total Payments</div>
        <div class="stat-unit">COUNT</div>
      </div>

      <!-- Revenue Last Day (720 blocks) -->
      <div class="stat-item day">
        <div class="stat-value">
          {blockRevenueLoading ? '...' : formatCurrency(blockRevenueData.day)}
        </div>
        <div class="stat-label">Day Revenue</div>
        <div class="stat-unit">{getCurrencyUnit()} (720 blocks)</div>
      </div>

      <!-- Revenue Last Week (5040 blocks) -->
      <div class="stat-item week">
        <div class="stat-value">
          {blockRevenueLoading ? '...' : formatCurrency(blockRevenueData.week)}
        </div>
        <div class="stat-label">Week Revenue</div>
        <div class="stat-unit">{getCurrencyUnit()} (5040 blocks)</div>
      </div>

      <!-- Revenue Last Month (21600 blocks) -->
      <div class="stat-item month">
        <div class="stat-value">
          {blockRevenueLoading ? '...' : formatCurrency(blockRevenueData.month)}
        </div>
        <div class="stat-label">Month Revenue</div>
        <div class="stat-unit">{getCurrencyUnit()} ({revenueConfig.blockPeriods.month} blocks)</div>
      </div>

      <!-- Revenue Last Year (262800 blocks) -->
      <div class="stat-item year">
        <div class="stat-value">
          {blockRevenueLoading ? '...' : formatCurrency(blockRevenueData.year)}
        </div>
        <div class="stat-label">Year Revenue</div>
        <div class="stat-unit">{getCurrencyUnit()} ({revenueConfig.blockPeriods.year} blocks)</div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Use CSS variables from the terminal theme */
  .flux-panel {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .panel-header {
    background: linear-gradient(135deg, var(--flux-border), var(--flux-blue));
    color: var(--flux-text);
    padding: 12px 20px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid var(--flux-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-content {
    padding: 20px;
  }

  /* Metrics Display */
  .metrics-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    font-size: 13px;
  }

  .metric-group {
    display: flex;
    gap: 20px;
  }

  .metric {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .metric-label {
    color: var(--flux-text-dim);
  }

  .metric-value {
    color: var(--flux-text);
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .metric-value.online {
    color: var(--status-online);
  }

  .price-value {
    color: var(--flux-green);
    font-weight: 600;
  }

  .price-status {
    color: var(--flux-green);
    font-size: 0.875rem;
    margin-left: 4px;
  }

  .price-status.error {
    color: var(--flux-red);
  }

  /* Currency Toggle */
  .currency-toggle {
    display: flex;
    gap: 0.25rem;
    background: var(--flux-bg);
    border-radius: 4px;
    padding: 0.25rem;
    border: 1px solid var(--flux-border);
  }

  .toggle-btn {
    background: transparent;
    color: var(--flux-text-dim);
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace;
  }

  .toggle-btn:hover:not(:disabled) {
    color: var(--flux-text);
    background: var(--flux-border);
  }

  .toggle-btn.active {
    background: var(--flux-blue);
    color: var(--flux-bg);
  }

  .toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 15px;
    margin: 20px 0;
  }

  .stat-item {
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
    text-align: center;
    transition: all 0.2s ease;
  }

  .stat-item:hover {
    border-color: var(--flux-blue);
    box-shadow: 0 0 8px rgba(92, 156, 204, 0.2);
  }

  /* Different colored accents for each stat type */
  .balance {
    border-left: 4px solid var(--flux-blue);
  }

  .last-payment {
    border-left: 4px solid var(--flux-green);
  }

  .transactions {
    border-left: 4px solid var(--flux-yellow);
  }

  .day {
    border-left: 4px solid var(--flux-cyan);
  }

  .week {
    border-left: 4px solid var(--flux-purple);
  }

  .month {
    border-left: 4px solid var(--flux-orange);
  }

  .year {
    border-left: 4px solid var(--flux-red);
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--flux-text);
    margin-bottom: 5px;
    font-family: 'JetBrains Mono', monospace;
    word-break: break-all;
  }

  .stat-label {
    font-size: 11px;
    color: var(--flux-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }

  .stat-unit {
    font-size: 10px;
    color: var(--flux-text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .stats-grid {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
    
    .stat-value {
      font-size: 16px;
    }
  }

  @media (max-width: 768px) {
    .metrics-row {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .stat-value {
      font-size: 14px;
    }

    .panel-content {
      padding: 15px;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .metric-group {
      flex-direction: column;
      gap: 8px;
    }
  }
</style>