<script>
  export let transactions = [];
  export let loading = false;
  export let selectedAddress = 'all'; // New prop for multi-address support
  
  let currentPage = 1;
  let itemsPerPage = 50;
  let searchTerm = '';
  let totalItems = 0;
  let totalPages = 0;
  let localLoading = false;
  
  // Debounce search to avoid too many API calls
  let searchTimeout;
  let lastSearchTerm = '';
  
  // Watch for changes that should trigger a new fetch
  $: if (currentPage || searchTerm !== lastSearchTerm || selectedAddress) {
    fetchTransactions();
  }
  
  async function fetchTransactions() {
    if (searchTerm !== lastSearchTerm) {
      currentPage = 1; // Reset to first page when search changes
      lastSearchTerm = searchTerm;
    }
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Debounce search requests
    if (searchTerm && searchTerm !== lastSearchTerm) {
      searchTimeout = setTimeout(() => {
        performFetch();
      }, 300);
    } else {
      performFetch();
    }
  }
  
  async function performFetch() {
    localLoading = true;
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });
      
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      
      if (selectedAddress && selectedAddress !== 'all') {
        params.set('address', selectedAddress);
      }
      
      const response = await fetch(`/api/transactions?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Update local state with server response
        transactions = data.transactions || [];
        totalItems = data.pagination?.totalItems || 0;
        totalPages = data.pagination?.totalPages || 0;
        
        console.log(`📄 Loaded page ${currentPage} of ${totalPages} (${transactions.length} transactions)`);
      } else {
        console.error('Failed to fetch transactions:', response.statusText);
        transactions = [];
        totalItems = 0;
        totalPages = 0;
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      transactions = [];
      totalItems = 0;
      totalPages = 0;
    } finally {
      localLoading = false;
    }
  }
  
  function goToPage(page) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      currentPage = page;
    }
  }
  
  function handleSearchInput(event) {
    searchTerm = event.target.value;
  }
  
  function formatAmount(amount) {
    if (typeof amount !== 'number') return '0.00000000';
    return amount.toFixed(8);
  }
  
  function formatAddress(address) {
    if (!address || address === 'Unknown') return 'Unknown';
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 10)}`;
  }
  
  function formatTransactionId(txId) {
    if (!txId) return 'Unknown';
    if (txId.length <= 20) return txId;
    return `${txId.substring(0, 12)}...${txId.substring(txId.length - 8)}`;
  }
  
  // Generate page numbers for pagination
  $: pageNumbers = (() => {
    const pages = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  })();
  
  // Calculate display range for pagination info
  $: startIndex = totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
  $: endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Format date for terminal display
  function formatTerminalDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  // Get transaction type indicator
  function getTransactionType(amount) {
    return amount > 0 ? 'IN' : 'OUT';
  }

  function getTypeColor(amount) {
    return amount > 0 ? 'var(--flux-green)' : 'var(--flux-orange)';
  }
</script>

<div class="flux-panel">
  <div class="panel-header">
    <span>Revenue Transaction Log</span>
    <span style="font-size: 12px; color: rgba(255,255,255,0.7);">
      {totalItems} transaction{totalItems !== 1 ? 's' : ''} 
      {searchTerm ? '(filtered)' : ''}
    </span>
  </div>
  
  <div class="panel-content">
    <!-- Terminal Status Bar -->
    <div class="terminal-status">
      <div class="status-group">
        <div class="status-item">
          <span class="status-label">Status:</span>
          <span class="status-value online">●</span>
        </div>
        <div class="status-item">
          <span class="status-label">Total TX:</span>
          <span class="status-value">{totalItems.toLocaleString()}</span>
        </div>
      </div>
      <div class="status-group">
        <div class="status-item">
          <span class="status-label">Page:</span>
          <span class="status-value">{currentPage}/{totalPages}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Mode:</span>
          <span class="status-value online">LIVE</span>
        </div>
      </div>
    </div>

    <!-- Search Interface -->
    <div class="search-section">
      <div class="search-header">Filter Transactions:</div>
      <div class="search-container">
        <span class="search-prompt">search$</span>
        <input 
          type="text" 
          placeholder="txid, address, amount..." 
          value={searchTerm}
          on:input={handleSearchInput}
          class="search-input"
        />
        {#if localLoading && searchTerm}
          <div class="search-loading">
            <div class="terminal-spinner">⣾</div>
          </div>
        {/if}
      </div>
    </div>

    {#if loading || localLoading}
      <div class="loading-section">
        <div class="loading-text">
          <div class="terminal-spinner large">⣾</div>
          <span>Loading transaction data...</span>
        </div>
      </div>
    {:else if transactions.length === 0}
      <div class="empty-section">
        <div class="empty-content">
          <div class="empty-icon">📊</div>
          <div class="empty-text">
            {searchTerm ? 'No matching transactions found' : 'No revenue transactions available'}
          </div>
          {#if searchTerm}
            <div class="empty-hint">Try adjusting your search terms</div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Transaction List (Terminal Style) -->
      <div class="transaction-section">
        <div class="transaction-header">Transaction Log ({transactions.length} entries):</div>
        
        <!-- Table Header -->
        <div class="table-header">
          <div class="header-row">
            <span class="col-type">TYPE</span>
            <span class="col-txid">TRANSACTION_ID</span>
            <span class="col-from">FROM_ADDRESS</span>
            <span class="col-to">TO_ADDRESS</span>
            <span class="col-amount">AMOUNT_FLUX</span>
            <span class="col-date">DATE</span>
            <span class="col-block">BLOCK</span>
          </div>
        </div>

        <!-- Transaction Rows -->
        <div class="table-body">
          {#each transactions as transaction, index (transaction.id || index)}
            <div class="transaction-row">
              <div class="row-content">
                <span class="col-type">
                  <span class="type-badge" style="color: {getTypeColor(transaction.amount)}">
                    {getTransactionType(transaction.amount)}
                  </span>
                </span>
                <span class="col-txid">
                  <a 
                    href="https://explorer.runonflux.io/tx/{transaction.id}" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="tx-link"
                    title={transaction.id}
                  >
                    {formatTransactionId(transaction.id)}
                  </a>
                </span>
                <span class="col-from" title={transaction.from}>
                  {formatAddress(transaction.from)}
                </span>
                <span class="col-to" title={transaction.to}>
                  {formatAddress(transaction.to)}
                </span>
                <span class="col-amount">
                  <span class="amount-value" style="color: {getTypeColor(transaction.amount)}">
                    {formatAmount(Math.abs(transaction.amount))}
                  </span>
                </span>
                <span class="col-date">
                  {formatTerminalDate(transaction.date)}
                </span>
                <span class="col-block">
                  <a 
                    href="https://explorer.runonflux.io/block/{transaction.blockHeight}" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="block-link"
                    title="View block {transaction.blockHeight}"
                  >
                    {transaction.blockHeight?.toLocaleString() || 'N/A'}
                  </a>
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Pagination Controls -->
      {#if totalPages > 1}
        <div class="pagination-section">
          <div class="pagination-header">Navigation:</div>
          
          <div class="pagination-controls">
            <div class="pagination-info">
              <span class="info-text">
                [{startIndex}-{endIndex}] of {totalItems.toLocaleString()} entries
              </span>
            </div>
            
            <div class="page-controls">
              <button 
                class="page-btn {currentPage === 1 ? 'disabled' : ''}" 
                disabled={currentPage === 1 || localLoading}
                on:click={() => goToPage(currentPage - 1)}
              >
                ←
              </button>
              
              {#each pageNumbers as pageNum}
                {#if pageNum === '...'}
                  <span class="page-ellipsis">...</span>
                {:else}
                  <button 
                    class="page-btn {pageNum === currentPage ? 'active' : ''}"
                    disabled={localLoading}
                    on:click={() => goToPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                {/if}
              {/each}
              
              <button 
                class="page-btn {currentPage === totalPages ? 'disabled' : ''}" 
                disabled={currentPage === totalPages || localLoading}
                on:click={() => goToPage(currentPage + 1)}
              >
                →
              </button>
            </div>
            
            <div class="page-size-controls">
              <span class="size-label">per_page:</span>
              <select bind:value={itemsPerPage} on:change={() => { currentPage = 1; }} class="size-select">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      {/if}
    {/if}
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

  /* Terminal Status Bar */
  .terminal-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
  }

  .status-group {
    display: flex;
    gap: 20px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-label {
    color: var(--flux-text-dim);
  }

  .status-value {
    color: var(--flux-text);
    font-weight: 500;
  }

  .status-value.online {
    color: var(--status-online);
  }

  /* Search Section */
  .search-section {
    margin-bottom: 20px;
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
  }

  .search-header {
    color: var(--flux-text-dim);
    font-size: 12px;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    position: relative;
  }

  .search-prompt {
    color: var(--flux-cyan);
    font-size: 14px;
    font-weight: 600;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--flux-text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    padding: 8px 0;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--flux-text-muted);
  }

  .search-loading {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
  }

  .terminal-spinner {
    color: var(--flux-cyan);
    font-family: 'JetBrains Mono', monospace;
    animation: spin-chars 0.8s linear infinite;
  }

  .terminal-spinner.large {
    font-size: 18px;
    margin-right: 10px;
  }

  @keyframes spin-chars {
    0% { content: '⣾'; }
    10% { content: '⣽'; }
    20% { content: '⣻'; }
    30% { content: '⢿'; }
    40% { content: '⡿'; }
    50% { content: '⣟'; }
    60% { content: '⣯'; }
    70% { content: '⣷'; }
    80% { content: '⣾'; }
    90% { content: '⣽'; }
    100% { content: '⣻'; }
  }

  /* Loading Section */
  .loading-section {
    text-align: center;
    padding: 40px 20px;
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
  }

  .loading-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--flux-text-dim);
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
  }

  /* Empty Section */
  .empty-section {
    text-align: center;
    padding: 40px 20px;
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
  }

  .empty-content {
    color: var(--flux-text-dim);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 15px;
  }

  .empty-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    color: var(--flux-text);
    margin-bottom: 8px;
  }

  .empty-hint {
    font-size: 12px;
    color: var(--flux-text-muted);
  }

  /* Transaction Section */
  .transaction-section {
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    margin-bottom: 20px;
    overflow: hidden;
  }

  .transaction-header {
    background: rgba(255, 255, 255, 0.02);
    padding: 12px 15px;
    border-bottom: 1px solid var(--flux-border);
    color: var(--flux-text-dim);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Table Styling */
  .table-header {
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--flux-border);
  }

  .header-row {
    display: grid;
    grid-template-columns: 60px 180px 160px 160px 140px 100px 100px;
    gap: 15px;
    padding: 10px 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    color: var(--flux-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .table-body {
    max-height: 600px;
    overflow-y: auto;
  }

  .transaction-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    transition: all 0.2s ease;
  }

  .transaction-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .row-content {
    display: grid;
    grid-template-columns: 60px 180px 160px 160px 140px 100px 100px;
    gap: 15px;
    padding: 8px 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    align-items: center;
  }

  .type-badge {
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 0.5px;
  }

  .tx-link, .block-link {
    color: var(--flux-cyan);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .tx-link:hover, .block-link:hover {
    color: var(--flux-blue);
  }

  .col-from, .col-to {
    color: var(--flux-text-dim);
    font-size: 10px;
  }

  .amount-value {
    font-weight: 600;
    text-align: right;
  }

  .col-date {
    color: var(--flux-text-dim);
    font-size: 10px;
  }

  /* Pagination Section */
  .pagination-section {
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
  }

  .pagination-header {
    color: var(--flux-text-dim);
    font-size: 12px;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .pagination-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    font-family: 'JetBrains Mono', monospace;
  }

  .pagination-info {
    color: var(--flux-text-dim);
    font-size: 12px;
  }

  .page-controls {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .page-btn {
    background: rgba(255, 255, 255, 0.03);
    color: var(--flux-text);
    border: 1px solid var(--flux-border);
    padding: 6px 10px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    min-width: 30px;
    text-align: center;
  }

  .page-btn:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--flux-cyan);
  }

  .page-btn.active {
    background: var(--flux-cyan);
    border-color: var(--flux-cyan);
    color: var(--flux-bg);
  }

  .page-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-ellipsis {
    color: var(--flux-text-muted);
    padding: 6px 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }

  .page-size-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .size-label {
    color: var(--flux-text-dim);
  }

  .size-select {
    background: rgba(255, 255, 255, 0.03);
    color: var(--flux-text);
    border: 1px solid var(--flux-border);
    border-radius: 3px;
    padding: 4px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }

  .size-select:focus {
    outline: none;
    border-color: var(--flux-cyan);
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .header-row, .row-content {
      grid-template-columns: 50px 160px 140px 140px 120px 90px 90px;
      gap: 12px;
      font-size: 10px;
    }
  }

  @media (max-width: 768px) {
    .panel-content {
      padding: 15px;
    }
    
    .terminal-status {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    
    .status-group {
      flex-direction: column;
      gap: 8px;
    }
    
    .header-row, .row-content {
      grid-template-columns: 40px 120px 100px 100px 80px 70px;
      gap: 10px;
      padding: 8px 15px;
      font-size: 9px;
    }
    
    .col-to {
      display: none;
    }
    
    .pagination-controls {
      flex-direction: column;
      gap: 10px;
    }
  }

  @media (max-width: 480px) {
    .header-row, .row-content {
      grid-template-columns: 35px 100px 80px 70px 60px;
      gap: 8px;
      padding: 6px 10px;
      font-size: 8px;
    }
    
    .col-from, .col-date, .col-block {
      display: none;
    }
    
    .page-controls {
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .page-btn {
      padding: 4px 8px;
      min-width: 25px;
      font-size: 10px;
    }
  }
</style>