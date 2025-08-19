
import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Routes, Route } from 'react-router-dom'
import Papa from 'papaparse'

const currency = (n) => (Number(n)||0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const uid = () => (crypto?.randomUUID?.() || Math.random().toString(36).slice(2))

// ---- Seeds (DD-MMM-YYYY) ----
const seedCategories = [
  { id: uid(), name: 'Utilities', type: 'Expense' },
  { id: uid(), name: 'Insurance', type: 'Expense' },
  { id: uid(), name: 'Shopping', type: 'Expense' },
  { id: uid(), name: 'Groceries', type: 'Expense' },
  { id: uid(), name: 'Dining', type: 'Expense' },
  { id: uid(), name: 'Income', type: 'Income' },
  { id: uid(), name: 'Savings', type: 'Savings' },
  { id: uid(), name: 'Misc', type: 'Expense' },
]
const seedIncome = [
  { id: uid(), date: '01-Jul-2025', source: 'Paycheck', amount: 2500, tags: 'salary' },
  { id: uid(), date: '15-Jul-2025', source: 'Paycheck', amount: 2500, tags: 'salary' },
  { id: uid(), date: '20-Jul-2025', source: 'Freelance', amount: 600,  tags: 'side' },
]
const seedBills = [
  { id: uid(), due: '20-Jul-2025', name: 'Electricity', category: 'Utilities', amount: 150, status: 'due' },
  { id: uid(), due: '25-Jul-2025', name: 'Internet',    category: 'Utilities', amount: 80,  status: 'paid' },
  { id: uid(), due: '10-Jul-2025', name: 'Allstate Insurance', category: 'Insurance', amount: 460, status: 'paid' },
  { id: uid(), due: '05-Jul-2025', name: 'Groceries (weekly)', category: 'Groceries', amount: 200, status: 'due' },
]

// ---- Local Storage helpers ----
const LS = {
  catsUrl: 'bd.catsUrl',
  incUrl: 'bd.incUrl',
  billsUrl: 'bd.billsUrl',
  cats: 'bd.cats',
  income: 'bd.income',
  bills: 'bd.bills'
}
const getLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const setLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// ---- Date helpers ----
const toDDMMMYYYY = (raw) => {
  if (!raw) return ''
  const s = String(raw).trim()
  // Already in DD-MMM-YYYY?
  const parts = s.split('-'); if (parts.length===3 && parts[1]?.length===3) return s
  // Try ISO or Date parseable
  let d = new Date(s)
  if (isNaN(d)) {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) d = new Date(`${m[2]}/${m[1]}/${m[3]}`)
  }
  if (isNaN(d)) return s
  const dd = String(d.getDate()).padStart(2,'0')
  const mmm = months[d.getMonth()]
  const yyyy = d.getFullYear()
  return `${dd}-${mmm}-${yyyy}`
}

const detectType = (headers) => {
  const h = headers.map(x=> String(x).trim().toLowerCase())
  const hasIncome = h.includes('source') && h.includes('amount') && h.some(x=> x.startsWith('date'))
  const hasBills  = h.includes('bill')   && h.includes('category') && h.includes('amount') && h.some(x=> x.startsWith('due'))
  const hasCats   = h.includes('name')   && h.includes('type') && h.length<=3
  if (hasBills) return 'bills'
  if (hasIncome) return 'income'
  if (hasCats) return 'categories'
  return 'unknown'
}

const mapIncome = (rows) => rows.map(r => ({
  id: uid(),
  date: toDDMMMYYYY(r['Date'] ?? r['date'] ?? r['Date (DD-MMM-YYYY)'] ?? r['date (dd-mmm-yyyy)']),
  source: r['Source'] ?? r['source'] ?? '',
  amount: Number(r['Amount'] ?? r['amount'] ?? 0),
  tags: (r['Tags'] ?? r['tags'] ?? '').toString()
}))
const mapBills = (rows) => rows.map(r => ({
  id: uid(),
  due: toDDMMMYYYY(r['Due Date'] ?? r['due date'] ?? r['Due'] ?? r['due']),
  name: r['Bill'] ?? r['bill'] ?? '',
  category: r['Category'] ?? r['category'] ?? '',
  amount: Math.abs(Number(r['Amount'] ?? r['amount'] ?? 0)),
  status: (r['Status'] ?? r['status'] ?? 'paid').toString()
}))
const mapCategories = (rows) => rows.map(r => ({
  id: uid(),
  name: r['Name'] ?? r['name'] ?? '',
  type: r['Type'] ?? r['type'] ?? 'Expense',
}))

// ---- App ----
export default function App(){
  const [categories, setCategories] = useState(getLS(LS.cats, seedCategories))
  const [income, setIncome] = useState(getLS(LS.income, seedIncome))
  const [bills, setBills] = useState(getLS(LS.bills, seedBills))

  const [catsUrl, setCatsUrl] = useState(localStorage.getItem(LS.catsUrl) || '')
  const [incUrl, setIncUrl]   = useState(localStorage.getItem(LS.incUrl) || '')
  const [billsUrl, setBillsUrl] = useState(localStorage.getItem(LS.billsUrl) || '')
  const [status, setStatus] = useState('')
  const [showDataBox, setShowDataBox] = useState(false) // collapsible "Data" pill

  // persist on change
  useEffect(()=> setLS(LS.cats, categories), [categories])
  useEffect(()=> setLS(LS.income, income), [income])
  useEffect(()=> setLS(LS.bills, bills), [bills])

  useEffect(()=> localStorage.setItem(LS.catsUrl, catsUrl), [catsUrl])
  useEffect(()=> localStorage.setItem(LS.incUrl, incUrl), [incUrl])
  useEffect(()=> localStorage.setItem(LS.billsUrl, billsUrl), [billsUrl])

  // Auto-load from URLs on first mount (if present)
  useEffect(()=>{
    const hasAny = catsUrl || incUrl || billsUrl
    if (hasAny) loadAll(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCSV = async (url) => {
    const bust = `&_=${Date.now()}`
    const res = await fetch(url + (url.includes('?') ? bust : '?'+bust), { cache: 'no-store' })
    if (!res.ok) throw new Error('Fetch failed')
    const text = await res.text()
    return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data || []
  }

  const loadAll = async (silent=false) => {
    try {
      if (!silent) setStatus('Loading...')
      let loadedCats=0, loadedInc=0, loadedBills=0
      if (catsUrl) { const d = await fetchCSV(catsUrl); setCategories(mapCategories(d)); loadedCats=d.length }
      if (incUrl)  { const d = await fetchCSV(incUrl);  setIncome(mapIncome(d));       loadedInc=d.length }
      if (billsUrl){ const d = await fetchCSV(billsUrl);setBills(mapBills(d));         loadedBills=d.length }
      if (!silent) setStatus(`Loaded ${loadedInc} income, ${loadedBills} bills, ${loadedCats} categories`)
    } catch (e) {
      if (!silent) setStatus('Load error. Ensure each tab is published as CSV and URLs are correct.')
    }
  }

  const onUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (res)=> {
        const rows = res.data || []
        const headers = res.meta?.fields || Object.keys(rows[0]||{})
        const type = detectType(headers)
        if (type==='income')      { const d = mapIncome(rows); setIncome(d); setStatus(`Loaded ${rows.length} income rows`) }
        else if (type==='bills')  { const d = mapBills(rows); setBills(d);   setStatus(`Loaded ${rows.length} bills rows`) }
        else if (type==='categories') { const d = mapCategories(rows); setCategories(d); setStatus(`Loaded ${rows.length} categories`) }
        else                     { setStatus('Unknown CSV. Use the provided templates.') }
      }
    })
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 md:sticky md:top-4 self-start">
          <div className="bg-stone-50 rounded-2xl shadow-sm p-4">
            <div className="text-xl font-semibold mb-2">Budget</div>
            <Nav to="/">Dashboard</Nav>
            <Nav to="/categories">Categories</Nav>
            <Nav to="/income">Income</Nav>
            <Nav to="/bills">Bills</Nav>

            {/* Data pill (collapsible) */}
            <div className="mt-4">
              <button className="w-full px-3 py-2 rounded-xl bg-stone-200 text-sm font-medium" onClick={()=> setShowDataBox(s=>!s)}>
                {showDataBox? 'Hide Data' : 'Show Data'}
              </button>
              {showDataBox && (
                <div className="mt-3 border border-stone-200 rounded-xl p-3 text-sm space-y-2">
                  <div className="font-medium">Google Sheets (Published CSV)</div>
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Categories CSV URL" value={catsUrl} onChange={e=> setCatsUrl(e.target.value)} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Income CSV URL" value={incUrl} onChange={e=> setIncUrl(e.target.value)} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Bills CSV URL" value={billsUrl} onChange={e=> setBillsUrl(e.target.value)} />
                  <button className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-sm" onClick={()=> loadAll(false)}>Load All</button>

                  <div className="pt-2 font-medium">Or upload a CSV</div>
                  <label className="px-3 py-1.5 rounded-lg bg-stone-700 text-white text-sm cursor-pointer inline-block">
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
            <Route index element={<Dashboard income={income} bills={bills} />} />
            <Route path="/categories" element={<CategoriesPage rows={categories} setRows={setCategories} />} />
            <Route path="/income" element={<IncomePage rows={income} setRows={setIncome} />} />
            <Route path="/bills" element={<BillsPage rows={bills} setRows={setBills} categoryOptions={categories.map(c=> c.name)} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Nav({ to, children }){
  return <NavLink to={to} className={({isActive})=> `block px-3 py-2 rounded-xl text-sm ${isActive?'bg-stone-200 font-semibold':'hover:bg-stone-200'}`}>{children}</NavLink>
}

function Dashboard({ income, bills }){
  const totalIncome = useMemo(()=> income.reduce((s,i)=> s+Number(i.amount||0),0), [income])
  const totalExpenses = useMemo(()=> bills.reduce((s,b)=> s+Number(b.amount||0),0), [bills])
  const net = totalIncome - totalExpenses

  const monthIndex = (dateStr) => months.indexOf((dateStr||'').split('-')[1])
  const groupByMonth = (rows, dateKey) => {
    const m = new Map(months.map((_,i)=> [i,0]))
    rows.forEach(r=> { const idx = monthIndex(r[dateKey]); if (idx>=0) m.set(idx, (m.get(idx)||0) + Number(r.amount||0)) })
    return months.map((_,i)=> m.get(i))
  }
  const incSeries = groupByMonth(income, 'date')
  const expSeries = groupByMonth(bills, 'due')
  const maxBar = Math.max(...incSeries, ...expSeries, 1)

  // Top 5 categories by spend
  const byCat = useMemo(()=> {
    const m = new Map()
    bills.forEach(b=> m.set(b.category||'Uncategorized', (m.get(b.category||'Uncategorized')||0) + Number(b.amount||0)))
    return [...m.entries()].sort((a,b)=> b[1]-a[1]).slice(0,5)
  }, [bills])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI title="Total Income" value={currency(totalIncome)} />
        <KPI title="Total Expenses" value={currency(totalExpenses)} />
        <KPI title="Net" value={currency(net)} positive={net>=0} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Income by Month"><MiniBars labels={months} values={incSeries} max={maxBar} color="bg-emerald-600" /></Card>
        <Card title="Expenses by Month"><MiniBars labels={months} values={expSeries} max={maxBar} color="bg-rose-600" /></Card>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Card title="Top 5 Categories by Spend">
          <div className="space-y-2">
            {byCat.map(([cat,val])=> (
              <div key={cat} className="flex items-center gap-2">
                <div className="w-40 text-sm text-stone-600">{cat}</div>
                <div className="flex-1 bg-stone-200 rounded-full h-3 overflow-hidden">
                  <div className="h-3 bg-stone-700" style={{ width: `${(val / (byCat[0]?.[1]||1)) * 100}%` }}></div>
                </div>
                <div className="w-24 text-right text-sm">{currency(val)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
const KPI = ({ title, value, positive }) => (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-sm text-stone-500">{title}</div><div className={`text-3xl font-semibold ${positive?'text-emerald-700':''}`}>{value}</div></div>)
const Card = ({ title, children }) => (<div className="bg-white rounded-2xl shadow-sm p-4"><div className="text-base font-semibold mb-2">{title}</div>{children}</div>)
const MiniBars = ({ labels, values, max, color}) => (<div className="grid grid-cols-12 gap-2 items-end min-h-[140px]">{values.map((v,i)=>(<div key={i} className="flex flex-col items-center gap-1"><div className={`w-full rounded-t-lg ${color}`} style={{height:`${Math.max(6,(v/max)*120)}px`}}></div><span className="text-[10px] text-stone-500">{labels[i]}</span></div>))}</div>)

function CategoriesPage({ rows, setRows }){
  return (<TablePage title="Categories" rows={rows} setRows={setRows}
    columns={[{key:'name',label:'Name'},{key:'type',label:'Type'}]}
    filters={[...new Set(rows.map(r=> r.type))]} pillField="type" />)
}
function IncomePage({ rows, setRows }){
  return (<TablePage title="Income" rows={rows} setRows={setRows}
    columns={[{key:'date',label:'Date (DD-MMM-YYYY)'},{key:'source',label:'Source'},{key:'amount',label:'Amount',type:'number',render:(v)=> currency(Number(v))},{key:'tags',label:'Tags'}]}
    filters={[...new Set(rows.flatMap(r=> String(r.tags||'').split(',').map(s=> s.trim()).filter(Boolean)))]}
    pillField="tags" />)
}
function BillsPage({ rows, setRows, categoryOptions }){
  return (<TablePage title="Bills" rows={rows} setRows={setRows}
    columns={[
      {key:'due',label:'Due (DD-MMM-YYYY)'},
      {key:'name',label:'Bill'},
      {key:'category',label:'Category', input:'select', options: categoryOptions},
      {key:'amount',label:'Amount',type:'number',render:(v)=> currency(Number(v))},
      {key:'status',label:'Status'}
    ]}
    filters={[...new Set(rows.map(r=> r.status))]} pillField="status" enableEdit categoriesForPills={categoryOptions} multiCategory />)
}

// Generic table with pagination, multi-select category pills (Bills), alternating rows, collapsible Add box
function TablePage({ title, columns, rows, setRows, filters=[], pillField, enableEdit=false, categoriesForPills=[], multiCategory=false }){
  const [sort, setSort] = useState({ key: columns[0].key, dir: 'asc' })
  const [active, setActive] = useState(multiCategory? [] : 'all')
  const [showAdd, setShowAdd] = useState(true)
  const [editId, setEditId] = useState(null)

  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const sorted = useMemo(()=> [...rows].sort((a,b)=> {
    const av = a[sort.key], bv = b[sort.key]
    if (av===bv) return 0
    return sort.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1)
  }), [rows, sort])

  const filtered = useMemo(()=> {
    let res = sorted
    if (pillField && (active!=='all' || (Array.isArray(active) && active.length))) {
      res = res.filter(r => {
        const val = r[pillField]
        if (Array.isArray(active)) return active.includes(String(val))
        if (Array.isArray(val)) return val.map(String).includes(String(active))
        return String(val) === String(active) || active==='all'
      })
    }
    // Multi-category pills for bills (independent of pillField)
    if (multiCategory && Array.isArray(active) && active.length){
      res = res.filter(r => active.includes(String(r.category||'')))
    }
    return res
  }, [sorted, active, pillField, multiCategory])

  // pagination
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / (pageSize || total)))
  const current = useMemo(()=> {
    if (!pageSize || pageSize === 'All') return filtered
    const start = (page-1)*pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const empty = Object.fromEntries(columns.map(c=> [c.key, c.type==='number'? 0 : '']))
  const [form, setForm] = useState(empty)
  const addRow = () => { setRows(prev=> [{ id: uid(), ...form }, ...prev]); setForm(empty) }
  const remove = (id) => setRows(prev => prev.filter(r => r.id !== id))
  const startEdit = (row) => { setEditId(row.id); setForm(columns.reduce((acc,c)=> ({...acc, [c.key]: row[c.key] ?? (c.type==='number'?0:'')}), {})) }
  const saveEdit = () => { setRows(prev => prev.map(r => r.id===editId? { ...r, ...form } : r)); setEditId(null); setForm(empty) }
  const cancelEdit = () => { setEditId(null); setForm(empty) }

  const toggleCat = (cat) => {
    setActive(a => {
      if (!Array.isArray(a)) return [cat]
      return a.includes(cat) ? a.filter(x=> x!==cat) : [...a, cat]
    })
  }
  const clearCats = () => setActive([])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>

      {/* Add box */}
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
            <div className="pt-2"><button className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm" onClick={addRow}>Add</button></div>
          </div>
        )}
      </div>

      {/* Multi-select category pills if provided */}
      {multiCategory && categoriesForPills.length>0 && (
        <div className="flex flex-wrap gap-2">
          <button className={`px-2 py-1 rounded-full text-xs ${(!Array.isArray(active) || active.length===0)?'bg-blue-100 text-blue-800':'bg-stone-200'}`} onClick={clearCats}>All</button>
          {categoriesForPills.map((c)=> (
            <button key={c} className={`px-2 py-1 rounded-full text-xs ${Array.isArray(active) && active.includes(c)?'bg-blue-100 text-blue-800':'bg-stone-200'}`} onClick={()=> toggleCat(c)}>{c}</button>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center gap-3 text-sm">
        <div>Rows per page:</div>
        <select className="bg-stone-100 rounded px-2 py-1" value={pageSize} onChange={e=> { const v = e.target.value==='All'? 0 : Number(e.target.value); setPageSize(v); setPage(1) }}>
          <option>25</option><option>50</option><option>100</option><option>All</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={page<=1} className="px-2 py-1 rounded bg-stone-200 disabled:opacity-50" onClick={()=> setPage(p=> Math.max(1,p-1))}>Prev</button>
          <span>Page {page} / {totalPages}</span>
          <button disabled={page>=totalPages} className="px-2 py-1 rounded bg-stone-200 disabled:opacity-50" onClick={()=> setPage(p=> Math.min(totalPages,p+1))}>Next</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            {columns.map((c,i)=> <col key={i} className={i===1? 'w-[40%]' : 'w-[15%]'} />)}
            <col className="w-[15%]" />
          </colgroup>
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
            {current.map((row, idx) => {
              const isEditing = enableEdit && row.id === editId
              return (
                <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-stone-50' : 'bg-white'} border-t border-stone-200`}>
                  {columns.map(col => (
                    <td key={col.key} className="py-2 px-3 whitespace-normal break-words">
                      {isEditing ? (
                        col.input === 'select' ? (
                          <select className="px-2 py-1 rounded bg-stone-100 text-sm" value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: e.target.value}))}>
                            <option value="">Select…</option>
                            {(col.options||[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input className="px-2 py-1 rounded bg-stone-100 text-sm w-full" type={col.type==='number'?'number':'text'} value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: col.type==='number'? Number(e.target.value) : e.target.value}))}/>
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
                          <button className="text-emerald-700 hover:underline" onClick={saveEdit}>Save</button>
                          <button className="text-stone-600 hover:underline" onClick={cancelEdit}>Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button className="text-stone-700 hover:underline" onClick={()=> startEdit(row)}>Edit</button>
                          <button className="text-rose-600 hover:underline" onClick={()=> remove(row.id)}>Delete</button>
                        </div>
                      )
                    ) : (
                      <button className="text-rose-600 hover:underline" onClick={()=> remove(row.id)}>Delete</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
