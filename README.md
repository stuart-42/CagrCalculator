# CAGR Portfolio Calculator

A client-side portfolio projection tool that models multi-asset growth using Compound Annual Growth Rate (CAGR) with inflation-adjusted withdrawals, tax handling, and legacy planning.

## Features

- **Multi-asset portfolio** - Track up to 5 assets with individual CAGR, price, and unit data
- **CAGR decay** - Each asset's growth rate reduces annually by a configurable amount, with a global floor
- **Inflation-adjusted withdrawals** - Annual withdrawals increase with inflation after a configurable retirement year
- **Withdrawal strategies** - Equal split, proportional to value, or protect-highest (withdraw from smallest first)
- **Protected assets** - Mark assets to exclude from withdrawals while still tracking their growth
- **Per-asset tax rates** - Set withdrawal tax rates per asset to model taxable vs tax-advantaged accounts
- **Pre-retirement contributions** - Add annual contributions to any asset until retirement
- **Legacy target** - Set a target portfolio value (in today's dollars) and check if it's met
- **Max withdrawal finder** - Binary search to find the highest sustainable withdrawal that meets the legacy target
- **Interactive chart** - Portfolio growth visualization with per-asset breakdown (Chart.js)
- **Yearly breakdown table** - Detailed year-by-year data including per-asset withdrawal and tax details
- **Local storage persistence** - Save/load portfolio data and settings in the browser
- **Responsive design** - Works on desktop, tablet, and mobile

## Usage

Open `index.html` in a browser. No build step or server required.

1. **Add/edit assets** - Click "Add Asset" or "Edit" on existing assets to set name, units, price, CAGR, reduction rate, contribution, tax rate, and protection status
2. **Configure settings** - Set CAGR floor, retirement/end years, withdrawal amount, inflation rate, withdrawal strategy, and legacy target
3. **Calculate** - Click "Calculate Projection" to run the simulation
4. **Find max withdrawal** - Click "Find Max Withdrawal" to determine the highest sustainable annual withdrawal that meets the legacy target
5. **Save/Reset** - Use "Save Data" to persist to localStorage, or "Reset" to restore defaults

## Project Structure

```
index.html   - Page structure and layout
style.css    - All styling (dark theme, responsive breakpoints)
app.js       - Calculator logic, rendering, chart, and storage
```

## Dependencies

- [Chart.js](https://www.chartjs.org/) (loaded via CDN) - portfolio growth chart
- [Google Fonts](https://fonts.google.com/) (loaded via CDN) - DM Sans and JetBrains Mono

## License

MIT
