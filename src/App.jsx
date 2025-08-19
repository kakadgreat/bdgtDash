
import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Routes, Route } from 'react-router-dom'
import Papa from 'papaparse'

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const currency = (n) => (Number(n)||0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })

const toDDMMMYYYY = (raw) => {
  if (!raw) return ''
  const s = String(raw).trim()
  let d = new Date(s)
  if (isNaN(d)) {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) d = new Date(`${m[2]}/${m[1]}/${m[3]}`)
  }
  if (isNaN(d)) {
    const parts = s.split('-')
    if (parts.length===3 && parts[1].length===3) return s
    return s
  }
  const dd = String(d.getDate()).padStart(2,'0')
  const mmm = months[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd}-${mmm}-${yyyy}`
}
const fromDDMMMYYYY = (s) => {
  if (!s) return null
  const [dd, mmm, yyyy] = String(s).split('-')
  const idx = months.indexOf(mmm)
  if (idx<0) return null
  return new Date(Number(yyyy), idx, Number(dd))
}

const LS_KEY = 'bdgt-v9'
const loadLS = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}') } catch { return {} } }
const saveLS = (obj) => localStorage.setItem(LS_KEY, JSON.stringify(obj))

// Config sources: env -> /config.json -> localStorage -> seed
const envCfg = {
  categoriesCsvUrl: import.meta.env.VITE_CATEGORIES_CSV_URL || '',
  incomeCsvUrl: import.meta.env.VITE_INCOME_CSV_URL || '',
  billsCsvUrl: import.meta.env.VITE_BILLS_CSV_URL || '',
  writebackUrl: import.meta.env.VITE_WRITEBACK_URL || ''
}

const seedCategories = [
  { id: crypto.randomUUID(), name: 'Utilities', type: 'Expense' },
  { id: crypto.randomUUID(), name: 'Insurance', type: 'Expense' },
  { id: crypto.randomUUID(), name: 'Groceries', type: 'Expense' },
  { id: crypto.randomUUID(), name: 'Dining', type: 'Expense' },
  { id: crypto.randomUUID(), name: 'Income', type: 'Income' },
]
const seedIncome = [
  { id: crypto.randomUUID(), date: '01-Jul-2025', source: 'Paycheck', amount: 2500, tags: 'salary' },
  { id: crypto.randomUUID(), date: '15-Jul-2025', source: 'Paycheck', amount: 2500, tags: 'salary' },
]
const seedBills = [
  { id: crypto.randomUUID(), due: '05-Jul-2025', name: 'Groceries (weekly)', category: 'Groceries', amount: 200, status: 'paid' },
  { id: crypto.randomUUID(), due: '10-Jul-2025', name: 'Allstate Insurance', category: 'Insurance', amount: 460, status: 'paid' },
  { id: crypto.randomUUID(), due: '25-Jul-2025', name: 'Internet', category: 'Utilities', amount: 80, status: 'paid' },
]

const detectType = (headers) => {
  const h = headers.map(x=> String(x).trim().toLowerCase())
  const hasIncome = h.includes('source') && h.includes('amount') && (h.includes('date') || h.includes('date (dd-mmm-yyyy)'))
  const hasBills  = (h.includes('bill') || h.includes('description')) && h.includes('category') && h.includes('amount') && (h.includes('due date') || h.includes('due') )
  const hasCats   = h.includes('name') && h.includes('type') && h.length<=4
  if (hasBills) return 'bills'
  if (hasIncome) return 'income'
  if (hasCats) return 'categories'
  return 'unknown'
}
const cleanMoney = (v) => Number(String(v||'').replace(/[$,]/g,'')||0)
const mapIncome = (rows) => rows.map(r => ({
  id: crypto.randomUUID(),
  date: toDDMMMYYYY(r['Date'] ?? r['date'] ?? r['Date (DD-MMM-YYYY)'] ?? r['date (dd-mmm-yyyy)']),
  source: r['Source'] ?? r['source'] ?? '',
  amount: cleanMoney(r['Amount'] ?? r['amount']),
  tags: r['Tags'] ?? r['tags'] ?? ''
}))
const mapBills = (rows) => rows.map(r => ({
  id: crypto.randomUUID(),
  due: toDDMMMYYYY(r['Due Date'] ?? r['due date'] ?? r['Due'] ?? r['due']),
  name: r['Bill'] ?? r['bill'] ?? r['Description'] ?? r['description'] ?? '',
  category: r['Category'] ?? r['category'] ?? 'Misc',
  amount: Math.abs(cleanMoney(r['Amount'] ?? r['amount'])),
  status: (r['Status'] ?? r['status'] ?? 'paid')
}))
const mapCategories = (rows) => rows.map(r => ({
  id: crypto.randomUUID(),
  name: r['Name'] ?? r['name'] ?? '',
  type: r['Type'] ?? r['type'] ?? 'Expense',
}))

const usePersistedState = (key, initial) => {
  const ls = loadLS()
  const [val, setVal] = useState(ls[key] ?? initial)
  useEffect(()=> { const snap = loadLS(); snap[key]=val; saveLS(snap) }, [key, val])
  return [val, setVal]
}

export default function App(){
  const [categories, setCategories] = usePersistedState('categories', seedCategories)
  const [income, setIncome] = usePersistedState('income', seedIncome)
  const [bills, setBills] = usePersistedState('bills', seedBills)

  const [cfg, setCfg] = usePersistedState('cfg', envCfg)
  const [status, setStatus] = useState('')
  const [showData, setShowData] = usePersistedState('showDataPanel', true)

  // Load /config.json once to override env (so you don't need to paste URLs)
  useEffect(()=> {
    fetch('/config.json', { cache: 'no-store' }).then(r=> r.json()).then(c=> {
      const merged = { ...cfg, ...c }
      setCfg(merged)
    }).catch(()=>{})
    // eslint-disable-next-line
  }, [])

  useEffect(()=>{
    // Auto-load when cfg has URLs
    if (cfg.categoriesCsvUrl || cfg.incomeCsvUrl || cfg.billsCsvUrl) {
      loadAll()
    }
    // eslint-disable-next-line
  }, [cfg.categoriesCsvUrl, cfg.incomeCsvUrl, cfg.billsCsvUrl])

  const fetchCSV = async (url) => {
    const res = await fetch(`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Fetch failed')
    const text = await res.text()
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    return parsed.data || []
  }
  const loadAll = async () => {
    try {
      setStatus('Loading...')
      let loadedCats=0, loadedInc=0, loadedBills=0
      if (cfg.categoriesCsvUrl) { const d = await fetchCSV(cfg.categoriesCsvUrl); setCategories(mapCategories(d)); loadedCats=d.length }
      if (cfg.incomeCsvUrl)     { const d = await fetchCSV(cfg.incomeCsvUrl);     setIncome(mapIncome(d));       loadedInc=d.length }
      if (cfg.billsCsvUrl)      { const d = await fetchCSV(cfg.billsCsvUrl);      setBills(mapBills(d));         loadedBills=d.length }
      setStatus(`Loaded ${loadedInc} income, ${loadedBills} bills, ${loadedCats} categories`)
    } catch (e) { setStatus('Load error. Check that each tab is published as CSV and URL is correct.') }
  }
  const onUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (res)=> {
        const rows = res.data || []
        const headers = res.meta?.fields || Object.keys(rows[0]||{})
        const type = detectType(headers)
        if (type==='income') { setIncome(mapIncome(rows)); setStatus(`Loaded ${rows.length} income rows from upload`) }
        else if (type==='bills') { setBills(mapBills(rows)); setStatus(`Loaded ${rows.length} bills rows from upload`) }
        else if (type==='categories') { setCategories(mapCategories(rows)); setStatus(`Loaded ${rows.length} categories from upload`) }
        else { setStatus('Unknown CSV headers. Use the templates.') }
      }
    })
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        {/* Sticky sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 md:sticky md:top-4 self-start">
          <div className="bg-stone-50 rounded-2xl shadow-sm p-4">
            <div className="text-xl font-semibold mb-2">Budget</div>
            <Nav to="/">Dashboard</Nav>
            <Nav to="/categories">Categories</Nav>
            <Nav to="/income">Income</Nav>
            <Nav to="/bills">Bills</Nav>
            <Nav to="/properties">Properties</Nav>
            <Nav to="/rentals">Rentals</Nav>
            <Nav to="/rentlog">Rent Log</Nav>

            {/* Data pill with show/hide */}
            <div className="mt-4 border-t border-stone-200 pt-3 text-sm">
              <button className="btn btn-ghost w-full justify-between" onClick={()=> setShowData(s=> !s)}>
                <span>Data</span><span>{showData? 'Hide' : 'Show'}</span>
              </button>
              {showData && (
                <div className="space-y-2 mt-2">
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Categories CSV URL" value={cfg.categoriesCsvUrl||''} onChange={e=> setCfg({...cfg, categoriesCsvUrl: e.target.value})} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Income CSV URL" value={cfg.incomeCsvUrl||''} onChange={e=> setCfg({...cfg, incomeCsvUrl: e.target.value})} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Bills CSV URL" value={cfg.billsCsvUrl||''} onChange={e=> setCfg({...cfg, billsCsvUrl: e.target.value})} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Writeback API URL (optional)" value={cfg.writebackUrl||''} onChange={e=> setCfg({...cfg, writebackUrl: e.target.value})} />
                  <button className="btn btn-primary w-full" onClick={loadAll}>Load All</button>
                  <div className="pt-1 font-medium">Or upload a CSV</div>
                  <label className="btn btn-ghost w-full cursor-pointer justify-center">
                    Upload CSV<input type="file" accept=".csv" className="hidden" onChange={onUpload}/>
                  </label>
                  <div className="text-xs text-stone-500">{status}</div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          <Routes>
            <Route index element={<Dashboard bills={bills} income={income} />} />
            <Route path="/categories" element={<CategoriesPage rows={categories} setRows={setCategories} />} />
            <Route path="/income" element={<IncomePage rows={income} setRows={setIncome} writebackUrl={cfg.writebackUrl} />} />
            <Route path="/bills" element={<BillsPage rows={bills} setRows={setBills} categories={categories} writebackUrl={cfg.writebackUrl} />} />
            <Route path="/properties" element={<PropertiesPage writebackUrl={cfg.writebackUrl} />} />
            <Route path="/rentals" element={<RentalsPage writebackUrl={cfg.writebackUrl} />} />
            <Route path="/rentlog" element={<RentLogPage writebackUrl={cfg.writebackUrl} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Nav({ to, children }){
  return <NavLink to={to} className={({isActive})=> `block px-3 py-2 rounded-xl text-sm ${isActive?'bg-stone-200 font-semibold':'hover:bg-stone-200'}`}>{children}</NavLink>
}

// Dashboard: include Top 5 + Top 20 + income/expense totals charts for rentals/properties (simple bars)
function Dashboard({ bills, income }){
  const spendByCat = useMemo(()=> {
    const map = new Map()
    bills.forEach(b=> {
      const cat = b.category || 'Misc'
      map.set(cat, (map.get(cat)||0) + Number(b.amount||0))
    })
    return Array.from(map.entries()).sort((a,b)=> b[1]-a[1])
  }, [bills])

  const top5 = spendByCat.slice(0,5)
  const top20 = spendByCat.slice(0,20)

  const totalIncome = useMemo(()=> income.reduce((s,i)=> s+Number(i.amount||0),0), [income])
  const totalExpenses = useMemo(()=> bills.reduce((s,b)=> s+Number(b.amount||0),0), [bills])
  const net = totalIncome - totalExpenses

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI title="Total Income" value={currency(totalIncome)} />
        <KPI title="Total Expenses" value={currency(totalExpenses)} />
        <KPI title="Net" value={currency(net)} positive={net>=0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top 5 Spend Categories"><BarList data={top5} color="bg-rose-600" /></Card>
        <Card title="Top 20 Spend Categories"><BarList data={top20} color="bg-rose-600" /></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Income Trend (12 months)"><MiniBars labels={months} values={seriesByMonth(income, 'date', 'amount')} color="bg-emerald-600" /></Card>
        <Card title="Expenses Trend (12 months)"><MiniBars labels={months} values={seriesByMonth(bills, 'due', 'amount')} color="bg-rose-600" /></Card>
      </div>
    </div>
  )
}
const KPI = ({ title, value, positive }) => (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-sm text-stone-500">{title}</div><div className={`text-3xl font-semibold ${positive?'text-emerald-700':''}`}>{value}</div></div>)
const Card = ({ title, children }) => (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-base font-semibold mb-2">{title}</div>{children}</div>)
function BarList({ data, color }){
  const max = Math.max(...data.map(d=> d[1]), 1)
  return (<div className="space-y-2">
    {data.map(([label, val])=> (
      <div key={label}>
        <div className="flex justify-between text-sm"><span className="truncate">{label}</span><span className="ml-2">{currency(val)}</span></div>
        <div className="h-2 bg-stone-200 rounded"><div className={`h-2 rounded ${color}`} style={{ width: `${(val/max)*100}%` }}></div></div>
      </div>
    ))}
  </div>)
}
function monthIndex(dateStr){
  const m = (dateStr||'').split('-')[1]
  return months.indexOf(m)
}
function seriesByMonth(rows, dateKey, valueKey){
  const m = new Map(months.map((_,i)=> [i,0]))
  rows.forEach(r=> {
    const idx = monthIndex(r[dateKey])
    if (idx>=0) m.set(idx, (m.get(idx)||0) + Number(r[valueKey]||0))
  })
  return months.map((_,i)=> m.get(i))
}
const MiniBars = ({ labels, values, color }) => {
  const max = Math.max(...values, 1)
  return (<div className="grid grid-cols-12 gap-2 items-end min-h-[140px]">
    {values.map((v,i)=>(<div key={i} className="flex flex-col items-center gap-1">
      <div className={`w-full rounded-t-lg ${color}`} style={{height:`${Math.max(6,(v/max)*120)}px`}}></div>
      <span className="text-[10px] text-stone-500">{labels[i]}</span>
    </div>))}
  </div>)
}

// Categories with Type dropdown
function CategoriesPage({ rows, setRows }){
  return (<TablePage
    title="Categories"
    rows={rows}
    setRows={setRows}
    columns={[
      {key:'name',label:'Name'},
      {key:'type',label:'Type', input:'select', options:['Expense','Income']},
    ]}
    enableEdit
  />)
}

// Export helpers
function exportCSV(filename, rows, columns){
  const header = columns.map(c=> c.label).join(',')
  const lines = rows.map(r => columns.map(c=> {
    const val = r[c.key]
    const str = (typeof val === 'string') ? `"${val.replace(/"/g,'""')}"` : val
    return str
  }).join(','))
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function exportPDF(title, rows, columns){
  const w = window.open('', '_blank')
  const style = `
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111827; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #e5e7eb; padding: 6px; word-break: break-word; }
      thead { display: table-header-group; }
    </style>`
  const head = `<h2>${title}</h2>`
  const thead = `<thead><tr>${columns.map(c=> `<th>${c.label}</th>`).join('')}</tr></thead>`
  const tbody = `<tbody>${rows.map(r=> `<tr>${columns.map(c=> `<td>${c.render ? c.render(r[c.key], r) : (r[c.key] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`
  w.document.write(`<html><head><title>${title}</title>${style}</head><body>${head}<table>${thead}${tbody}</table></body></html>`)
  w.document.close(); w.focus(); w.print()
}

// DateRange
function DateRange({ from, to, setFrom, setTo }){
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <div className="text-xs text-stone-500">From (DD-MMM-YYYY)</div>
        <input className="px-3 py-2 rounded-lg bg-stone-100 text-sm" placeholder="01-Jan-2025" value={from} onChange={(e)=> setFrom(e.target.value)} />
      </div>
      <div>
        <div className="text-xs text-stone-500">To (DD-MMM-YYYY)</div>
        <input className="px-3 py-2 rounded-lg bg-stone-100 text-sm" placeholder="31-Dec-2025" value={to} onChange={(e)=> setTo(e.target.value)} />
      </div>
    </div>
  )
}

// Writeback helper (Apps Script/Webhook)
async function writeBack(writebackUrl, sheet, row){
  if (!writebackUrl) return
  try{
    await fetch(writebackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet, row })
    })
  }catch(e){ console.warn('Writeback failed', e) }
}

// Income
function IncomePage({ rows, setRows, writebackUrl }){
  const columns = [
    {key:'date',label:'Date'},
    {key:'source',label:'Source'},
    {key:'amount',label:'Amount', type:'number', render:(v)=> currency(Number(v))},
    {key:'tags',label:'Tags'}
  ]
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [pageSize, setPageSize] = useState(25), [page, setPage] = useState(1)

  const filtered = useMemo(()=> rows.filter(r => {
    const d = fromDDMMMYYYY(r.date); if (!d) return true
    const f = fromDDMMMYYYY(from) || new Date(-8640000000000000)
    const t = fromDDMMMYYYY(to) || new Date(8640000000000000)
    return d>=f && d<=t
  }), [rows, from, to])

  const totalPages = Math.max(1, Math.ceil(filtered.length / (pageSize||filtered.length)))
  const pageRows = useMemo(()=> (pageSize ? filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize) : filtered), [filtered, pageSize, page])

  const addRow = (newRow) => { setRows(prev=> [...prev, newRow]); writeBack(writebackUrl, 'Income', newRow) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" onClick={()=> exportCSV('income.csv', filtered, columns)}>Export CSV</button>
          <button className="btn btn-ghost" onClick={()=> exportPDF('Income', filtered, columns)}>Export PDF</button>
        </div>
      </div>

      <TablePage
        title="Income"
        rows={pageRows}
        setRows={setRows}
        columns={columns}
        onAdd={(row)=> addRow({ id: crypto.randomUUID(), ...row })}
        onEdit={(row)=> writeBack(writebackUrl, 'Income', row)}
        onDelete={(row)=> writeBack(writebackUrl, 'Income', { ...row, _deleted: true })}
        pagination={{ pageSize, setPageSize, page, setPage, totalPages }}
        className="table-fixed-layout"
        enableEdit
      />
    </div>
  )
}

// Bills
function BillsPage({ rows, setRows, categories, writebackUrl }){
  const expenseCats = useMemo(()=> categories.filter(c=> (c.type||'Expense')==='Expense').map(c=> c.name), [categories])
  const columns = [
    {key:'due',label:'Due'},
    {key:'name',label:'Bill'},
    {key:'category',label:'Category', input:'select', options: expenseCats},
    {key:'amount',label:'Amount', type:'number', render:(v)=> currency(Number(v))},
    {key:'status',label:'Status'}
  ]

  const [activeCats, setActiveCats] = useState([])
  const toggleCat = (c) => setActiveCats(prev => prev.includes(c) ? prev.filter(x=> x!==c) : [...prev, c])
  const clearCats = () => setActiveCats([])

  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [pageSize, setPageSize] = useState(25), [page, setPage] = useState(1)

  const filtered = useMemo(()=> rows.filter(r => {
    const inCat = activeCats.length ? activeCats.includes(r.category) : true
    const d = fromDDMMMYYYY(r.due); if (!d) return inCat
    const f = fromDDMMMYYYY(from) || new Date(-8640000000000000)
    const t = fromDDMMMYYYY(to) || new Date(8640000000000000)
    return inCat && d>=f && d<=t
  }), [rows, activeCats, from, to])

  const totalPages = Math.max(1, Math.ceil(filtered.length / (pageSize||filtered.length)))
  const pageRows = useMemo(()=> (pageSize ? filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize) : filtered), [filtered, pageSize, page])

  const addRow = (newRow) => { setRows(prev=> [...prev, newRow]); writeBack(writebackUrl, 'Bills', newRow) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {expenseCats.map(c=> (
          <button key={c} className={`pill ${activeCats.includes(c)?'pill-active bg-sky-200':'bg-stone-200'}`} onClick={()=> toggleCat(c)}>{c}</button>
        ))}
        <button className="pill bg-stone-300" onClick={clearCats}>Clear</button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <div className="ml-auto flex gap-2">
          <button className="btn btn-ghost" onClick={()=> exportCSV('bills.csv', filtered, columns)}>Export CSV</button>
          <button className="btn btn-ghost" onClick={()=> exportPDF('Bills', filtered, columns)}>Export PDF</button>
        </div>
      </div>

      <TablePage
        title="Bills"
        rows={pageRows}
        setRows={setRows}
        columns={columns}
        onAdd={(row)=> addRow({ id: crypto.randomUUID(), ...row })}
        onEdit={(row)=> writeBack(writebackUrl, 'Bills', row)}
        onDelete={(row)=> writeBack(writebackUrl, 'Bills', { ...row, _deleted: true })}
        enableEdit
        pagination={{ pageSize, setPageSize, page, setPage, totalPages }}
        className="table-fixed-layout"
      />
    </div>
  )
}

// Properties Page
function PropertiesPage({ writebackUrl }){
  const [rows, setRows] = useState([
    { id: crypto.randomUUID(), address: '1005 Blankets Creek Dr, Canton, GA 30114', purchasePrice: '', mortgage: '', rate: '', start: '', escrow: '', notes: '' },
    { id: crypto.randomUUID(), address: '1076 W Church St, Jasper, GA 30143', purchasePrice: '', mortgage: '', rate: '', start: '', escrow: '', notes: '' },
    { id: crypto.randomUUID(), address: '699 Gordon Rd, Jasper, GA 30143', purchasePrice: '', mortgage: '', rate: '', start: '', escrow: '', notes: '' },
  ])
  return (
    <TablePage
      title="Properties"
      rows={rows}
      setRows={setRows}
      columns={[
        {key:'address',label:'Address'},
        {key:'purchasePrice',label:'Purchase Price'},
        {key:'mortgage',label:'Monthly Mortgage'},
        {key:'rate',label:'Interest Rate %'},
        {key:'start',label:'Loan Start (DD-MMM-YYYY)'},
        {key:'escrow',label:'Escrow/Taxes'},
        {key:'notes',label:'Notes'},
      ]}
      onAdd={(row)=> writeBack(writebackUrl, 'Properties', row)}
      onEdit={(row)=> writeBack(writebackUrl, 'Properties', row)}
      onDelete={(row)=> writeBack(writebackUrl, 'Properties', { ...row, _deleted: true })}
      enableEdit
      className="table-fixed-layout"
    />
  )
}

// Rentals Page
function RentalsPage({ writebackUrl }){
  const [rows, setRows] = useState([
    { id: crypto.randomUUID(), address: '1076 W Church St, Jasper, GA 30143', tenant: '', rent: '', due: '01', deposit: '', leaseStart: '', leaseEnd: '', status: 'Vacant', maint: '', expenses: '', notes: '' },
    { id: crypto.randomUUID(), address: '699 Gordon Rd, Jasper, GA 30143', tenant: '', rent: '', due: '01', deposit: '', leaseStart: '', leaseEnd: '', status: 'Vacant', maint: '', expenses: '', notes: '' },
  ])
  return (
    <TablePage
      title="Rentals"
      rows={rows}
      setRows={setRows}
      columns={[
        {key:'address',label:'Address'},
        {key:'tenant',label:'Tenant'},
        {key:'rent',label:'Monthly Rent'},
        {key:'due',label:'Due Day'},
        {key:'deposit',label:'Deposit'},
        {key:'leaseStart',label:'Lease Start (DD-MMM-YYYY)'},
        {key:'leaseEnd',label:'Lease End (DD-MMM-YYYY)'},
        {key:'status',label:'Status', input:'select', options:['Vacant','Occupied','Notice']},
        {key:'maint',label:'Maintenance Notes'},
        {key:'expenses',label:'Expenses (Last 30d)'},
        {key:'notes',label:'Notes'},
      ]}
      onAdd={(row)=> writeBack(writebackUrl, 'Rentals', row)}
      onEdit={(row)=> writeBack(writebackUrl, 'Rentals', row)}
      onDelete={(row)=> writeBack(writebackUrl, 'Rentals', { ...row, _deleted: true })}
      enableEdit
      className="table-fixed-layout"
    />
  )
}

// Rent Log Page with summary + charts
function RentLogPage({ writebackUrl }){
  const [rows, setRows] = useState([
    { id: crypto.randomUUID(), date: '01-Jul-2025', property: '1076 W Church St, Jasper, GA 30143', tenant: '', amount: 0, method: 'ACH', notes: '' },
    { id: crypto.randomUUID(), date: '01-Jul-2025', property: '699 Gordon Rd, Jasper, GA 30143', tenant: '', amount: 0, method: 'ACH', notes: '' },
  ])

  const total = rows.reduce((s,r)=> s + Number(r.amount||0), 0)
  const byProp = useMemo(()=> {
    const m = new Map()
    rows.forEach(r=> m.set(r.property, (m.get(r.property)||0) + Number(r.amount||0)))
    return Array.from(m.entries()).sort((a,b)=> b[1]-a[1])
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI title="Total Rent Collected" value={currency(total)} />
        <KPI title="Payments" value={rows.length} />
        <KPI title="Avg Payment" value={currency(rows.length? total/rows.length : 0)} />
      </div>

      <Card title="By Property"><BarList data={byProp} color="bg-emerald-600" /></Card>

      <TablePage
        title="Rent Log"
        rows={rows}
        setRows={setRows}
        columns={[
          {key:'date',label:'Date (DD-MMM-YYYY)'},
          {key:'property',label:'Property'},
          {key:'tenant',label:'Tenant'},
          {key:'amount',label:'Amount', type:'number'},
          {key:'method',label:'Method'},
          {key:'notes',label:'Notes'}
        ]}
        onAdd={(row)=> writeBack(writebackUrl, 'RentLog', row)}
        onEdit={(row)=> writeBack(writebackUrl, 'RentLog', row)}
        onDelete={(row)=> writeBack(writebackUrl, 'RentLog', { ...row, _deleted: true })}
        enableEdit
        className="table-fixed-layout"
      />
    </div>
  )
}

// Generic Table
function TablePage({ title, columns, rows, setRows, onAdd, onEdit, onDelete, enableEdit=false, pagination, className='' }){
  const [sort, setSort] = useState({ key: columns[0].key, dir: 'asc' })
  const sorted = useMemo(()=> [...rows].sort((a,b)=> sort.dir==='asc' ? (a[sort.key]>b[sort.key]?1:-1) : (a[sort.key]<b[sort.key]?1:-1)), [rows, sort])

  const [showAdd, setShowAdd] = useState(true)
  const [editId, setEditId] = useState(null)
  const empty = Object.fromEntries(columns.map(c=> [c.key, c.type==='number'? 0 : '']))
  const [form, setForm] = useState(empty)

  const addRow = () => { const newRow = { id: crypto.randomUUID(), ...form }; setRows(prev=> [...prev, newRow]); setForm(empty); onAdd && onAdd(newRow) }
  const remove = (id) => {
    const row = rows.find(r=> r.id===id)
    setRows(prev => prev.filter(r => r.id !== id))
    onDelete && onDelete(row)
  }
  const startEdit = (row) => { setEditId(row.id); setForm(columns.reduce((acc,c)=> ({...acc, [c.key]: row[c.key] ?? (c.type==='number'?0:'')}), {})) }
  const saveEdit = () => {
    setRows(prev => prev.map(r => r.id===editId? { ...r, ...form } : r))
    const updated = rows.find(r=> r.id===editId)
    onEdit && onEdit({ ...(updated||{}), ...form, id: editId })
    setEditId(null); setForm(empty)
  }
  const cancelEdit = () => { setEditId(null); setForm(empty) }

  const ps = pagination?.pageSize || null
  const setPs = pagination?.setPageSize || (()=>{})
  const page = pagination?.page || 1
  const setPage = pagination?.setPage || (()=>{})
  const totalPages = pagination?.totalPages || 1

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">Rows:</span>
          <select className="px-2 py-1 rounded bg-stone-100 text-sm" value={ps||''} onChange={(e)=> setPs(e.target.value==='All'? null : Number(e.target.value))}>
            <option>25</option><option>50</option><option>100</option><option>All</option>
          </select>
        </div>
      </div>

      {/* Add New */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Add New</div>
          <button className="text-sm text-stone-600 underline" onClick={()=> setShowAdd(s=> !s)}>{showAdd? 'Hide' : 'Show'}</button>
        </div>
        {showAdd && (
          <div className="pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {columns.map(col => (
                <div key={col.key}>
                  {col.input === 'select' ? (
                    <select className="px-3 py-2 rounded-lg bg-stone-100 text-sm w-full" value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: e.target.value}))}>
                      <option value="">Select…</option>
                      {(col.options||[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input className="px-3 py-2 rounded-lg bg-stone-100 text-sm w-full" placeholder={col.label} type={col.type==='number'?'number':'text'} value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: col.type==='number'? Number(e.target.value) : e.target.value}))}/>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-2"><button className="btn btn-primary" onClick={addRow}>Add</button></div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500">
              {columns.map(col => (
                <th key={col.key} className="py-2 px-3 cursor-pointer" onClick={()=> setSort(s=> ({ key: col.key, dir: s.dir==='asc'?'desc':'asc' }))}>
                  {col.label}
                </th>
              ))}
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => {
              const isEditing = enableEdit && row.id === editId
              return (
                <tr key={row.id || idx} className={`${idx % 2 === 0 ? 'bg-stone-50' : 'bg-white'} border-t border-stone-200`}>
                  {columns.map(col => (
                    <td key={col.key} className="py-2 px-3 whitespace-normal break-words">
                      {isEditing ? (
                        col.input === 'select' ? (
                          <select className="px-2 py-1 rounded bg-stone-100 text-sm" value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: e.target.value}))}>
                            <option value="">Select…</option>
                            {(col.options||[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input className="px-2 py-1 rounded bg-stone-100 text-sm" type={col.type==='number'?'number':'text'} value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: col.type==='number'? Number(e.target.value) : e.target.value}))}/>
                        )
                      ) : (
                        col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')
                      )}
                    </td>
                  ))}
                  <td className="py-2 px-3">
                    {enableEdit ? (
                      isEditing ? (
                        <div className="flex gap-2">
                          <button className="btn btn-success" onClick={saveEdit}>Save</button>
                          <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className="btn btn-ghost" onClick={()=> startEdit(row)}>Edit</button>
                          <button className="btn btn-danger" onClick={()=> remove(row.id)}>Delete</button>
                        </div>
                      )
                    ) : (
                      <button className="btn btn-danger" onClick={()=> remove(row.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-stone-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={()=> pagination.setPage(Math.max(1, page-1))}>Prev</button>
            <button className="btn btn-ghost" onClick={()=> pagination.setPage(Math.min(totalPages, page+1))}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
