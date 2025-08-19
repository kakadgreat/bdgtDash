
import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Routes, Route } from 'react-router-dom'
import Papa from 'papaparse'

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const currency = n => (Number(n)||0).toLocaleString(undefined,{style:'currency',currency:'USD'})

const seedCategories=[
  {id:crypto.randomUUID(),name:'Utilities',type:'Expense'},
  {id:crypto.randomUUID(),name:'Insurance',type:'Expense'},
  {id:crypto.randomUUID(),name:'Groceries',type:'Expense'},
  {id:crypto.randomUUID(),name:'Dining',type:'Expense'},
  {id:crypto.randomUUID(),name:'Income',type:'Income'},
]
const seedIncome=[
  {id:crypto.randomUUID(),date:'01-Jul-2025',source:'Paycheck',amount:2500,tags:'salary'},
  {id:crypto.randomUUID(),date:'15-Jul-2025',source:'Paycheck',amount:2500,tags:'salary'},
]
const seedBills=[
  {id:crypto.randomUUID(),due:'05-Jul-2025',name:'Internet',category:'Utilities',amount:80,status:'paid'},
  {id:crypto.randomUUID(),due:'10-Jul-2025',name:'Allstate Insurance',category:'Insurance',amount:460,status:'paid'},
]

// ---- localStorage helpers ----
const LS = {
  get: (k, d)=> { try{ return JSON.parse(localStorage.getItem(k) || 'null') ?? d } catch { return d } },
  set: (k, v)=> localStorage.setItem(k, JSON.stringify(v))
}

const toDDMMMYYYY = (raw) => {
  if (!raw) return ''
  const s=String(raw).trim()
  // if already DD-MMM-YYYY, keep
  const m1 = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s)
  if (m1) return s
  // try ISO or MM/DD/YYYY
  let d = new Date(s)
  if (isNaN(d)) {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) d = new Date(`${m[2]}/${m[1]}/${m[3]}`)
  }
  if (isNaN(d)) return s
  const dd=String(d.getDate()).padStart(2,'0'), mmm=months[d.getMonth()], yyyy=d.getFullYear()
  return `${dd}-${mmm}-${yyyy}`
}

// map CSV -> app rows with robust header matching
const h = (obj, keys) => {
  for (const k of keys) {
    if (k in obj) return obj[k]
    const found = Object.keys(obj).find(x => x && x.toLowerCase().trim() === k.toLowerCase().trim())
    if (found) return obj[found]
  }
  return ''
}

const mapIncome = rows => rows.map(r => ({
  id: crypto.randomUUID(),
  date: toDDMMMYYYY(h(r, ['Date','Date (DD-MMM-YYYY)','date'])),
  source: h(r, ['Source','source']),
  amount: Number(h(r, ['Amount','amount']).toString().replace(/[$,]/g,'')) || 0,
  tags: h(r, ['Tags','tags'])
})).filter(r => r.date && r.source)

const mapBills = rows => rows.map(r => ({
  id: crypto.randomUUID(),
  due: toDDMMMYYYY(h(r, ['Due Date','Due','due date','due'])),
  name: h(r, ['Bill','Description','bill']),
  category: h(r, ['Category','category']) || 'Misc',
  amount: Math.abs(Number(h(r, ['Amount','amount']).toString().replace(/[$,]/g,'')) || 0),
  status: (h(r, ['Status','status']) || 'paid').trim()
})).filter(r => r.due && r.name)

const mapCategories = rows => rows.map(r => ({
  id: crypto.randomUUID(),
  name: h(r, ['Name','name']),
  type: (h(r, ['Type','type']) || 'Expense')
})).filter(r => r.name)

export default function App(){
  const [categories, setCategories] = useState(LS.get('cats', seedCategories))
  const [income, setIncome] = useState(LS.get('inc', seedIncome))
  const [bills, setBills] = useState(LS.get('bills', seedBills))

  const [catsUrl, setCatsUrl] = useState(LS.get('catsUrl',''))
  const [incUrl, setIncUrl]   = useState(LS.get('incUrl',''))
  const [billsUrl, setBillsUrl] = useState(LS.get('billsUrl',''))
  const [status, setStatus] = useState('')

  const [showDataPanel, setShowDataPanel] = useState(LS.get('showDataPanel', true))

  // persist on change
  useEffect(()=> { LS.set('cats', categories) }, [categories])
  useEffect(()=> { LS.set('inc', income) }, [income])
  useEffect(()=> { LS.set('bills', bills) }, [bills])
  useEffect(()=> { LS.set('catsUrl', catsUrl); LS.set('incUrl', incUrl); LS.set('billsUrl', billsUrl) }, [catsUrl, incUrl, billsUrl])
  useEffect(()=> { LS.set('showDataPanel', showDataPanel) }, [showDataPanel])

  // auto-load once if URLs exist
  useEffect(()=> {
    const first = LS.get('loadedOnce', false)
    if (!first && (catsUrl || incUrl || billsUrl)) loadAll().finally(()=> LS.set('loadedOnce', true))
    // eslint-disable-next-line
  }, [])

  const fetchCSV = async (url) => {
    const bust = url.includes('output=csv') ? `${url}&_=${Date.now()}` : url
    const res = await fetch(bust, { cache: 'no-store' })
    if (!res.ok) throw new Error('Fetch failed')
    const text = await res.text()
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
    return parsed.data || []
  }

  const loadAll = async () => {
    try {
      setStatus('Loading...')
      let c=0,i=0,b=0
      if (catsUrl) { const d = await fetchCSV(catsUrl); setCategories(mapCategories(d)); c=d.length }
      if (incUrl)  { const d = await fetchCSV(incUrl);  setIncome(mapIncome(d));       i=d.length }
      if (billsUrl){ const d = await fetchCSV(billsUrl);setBills(mapBills(d));         b=d.length }
      setStatus(`Loaded ${i} income, ${b} bills, ${c} categories`)
    } catch (e) {
      setStatus('Load error. Ensure each Sheet tab is published as CSV.')
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800">
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-4">
        {/* Sticky sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 md:sticky md:top-4 self-start">
          <div className="bg-stone-50 rounded-2xl shadow-sm p-4">
            <div className="text-xl font-semibold mb-3">Budget</div>
            <Nav to="/">Dashboard</Nav>
            <Nav to="/categories">Categories</Nav>
            <Nav to="/income">Income</Nav>
            <Nav to="/bills">Bills</Nav>

            {/* Data panel pill */}
            <div className="mt-4">
              <button className="w-full px-3 py-2 rounded-xl bg-stone-800 text-white text-sm" onClick={()=> setShowDataPanel(s=>!s)}>{showDataPanel? 'Hide' : 'Show'} Data</button>
              {showDataPanel && (
                <div className="mt-3 border-t border-stone-200 pt-3 text-sm space-y-2">
                  <div className="font-medium">Google Sheets (Published CSV)</div>
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Categories CSV URL" value={catsUrl} onChange={e=> setCatsUrl(e.target.value)} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Income CSV URL" value={incUrl} onChange={e=> setIncUrl(e.target.value)} />
                  <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Bills CSV URL" value={billsUrl} onChange={e=> setBillsUrl(e.target.value)} />
                  <button className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-sm" onClick={loadAll}>Load All</button>

                  <div className="pt-2 font-medium">Or upload a CSV</div>
                  <label className="px-3 py-1.5 rounded-lg bg-stone-700 text-white text-sm cursor-pointer inline-block">
                    Upload CSV<input type="file" accept=".csv" className="hidden"
                      onChange={(e)=> {
                        const f = e.target.files?.[0]; if (!f) return;
                        Papa.parse(f, { header: true, dynamicTyping: true, skipEmptyLines: true, complete: (res)=> {
                          const rows = res.data||[]
                          const headers = res.meta?.fields || Object.keys(rows[0]||{})
                          const lower = headers.map(h=> (h||'').toLowerCase())
                          const isBills = ['bill','category','amount'].every(k=> lower.includes(k)) && (lower.includes('due date')||lower.includes('due'))
                          const isIncome = lower.includes('source') && lower.includes('amount') && lower.includes('date')
                          const isCats = lower.includes('name') && lower.includes('type')
                          if (isBills) { setBills(mapBills(rows)); setStatus(`Loaded ${rows.length} bills from upload`) }
                          else if (isIncome) { setIncome(mapIncome(rows)); setStatus(`Loaded ${rows.length} income from upload`) }
                          else if (isCats) { setCategories(mapCategories(rows)); setStatus(`Loaded ${rows.length} categories from upload`) }
                          else setStatus('Unknown CSV format.')
                        }})
                      }}/>
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

  // top 5 categories by spend
  const spendByCat = useMemo(()=> {
    const m = new Map()
    bills.forEach(b => m.set(b.category || 'Uncategorized', (m.get(b.category || 'Uncategorized')||0) + Number(b.amount||0)))
    return [...m.entries()].sort((a,b)=> b[1]-a[1]).slice(0,5)
  }, [bills])

  const monthIndex = (dateStr) => {
    const m = (dateStr||'').split('-')[1]
    return months.indexOf(m)
  }
  const byMonth = (rows, key) => {
    const m = new Map(months.map((_,i)=> [i,0]))
    rows.forEach(r=> {
      const idx = monthIndex(key==='income'? r.date : r.due)
      if (idx>=0) m.set(idx, (m.get(idx)||0) + Number(r.amount||0))
    })
    return months.map((_,i)=> m.get(i))
  }
  const incSeries = byMonth(income, 'income')
  const expSeries = byMonth(bills, 'bills')
  const maxBar = Math.max(...incSeries, ...expSeries, 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPI title="Total Income" value={currency(totalIncome)} />
        <KPI title="Total Expenses" value={currency(totalExpenses)} />
        <KPI title="Net" value={currency(net)} positive={net>=0} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Income by Month"><MiniBars labels={months} values={incSeries} max={maxBar} color="bg-emerald-600" /></Card>
        <Card title="Expenses by Month"><MiniBars labels={months} values={expSeries} max={maxBar} color="bg-rose-600" /></Card>
        <Card title="Top 5 Spend Categories">
          <div className="space-y-2">
            {spendByCat.map(([cat,val]) => (
              <div key={cat} className="flex items-center gap-2">
                <div className="flex-1 text-sm">{cat}</div>
                <div className="w-40 bg-stone-200 h-2 rounded"><div className="h-2 bg-stone-600 rounded" style={{width: `${Math.min(100, (val/(spendByCat[0]?.[1]||1))*100)}%`}}/></div>
                <div className="w-20 text-right text-sm">{currency(val)}</div>
              </div>
            ))}
            {spendByCat.length===0 && <div className="text-sm text-stone-500">No bills yet</div>}
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
    columns={[
      {key:'name',label:'Name'},
      {key:'type',label:'Type', input:'select', options:['Expense','Income']},
    ]}
    filters={[...new Set(rows.map(r=> r.type))]} pillField="type" />)
}
function IncomePage({ rows, setRows }){
  return (<TablePage title="Income" rows={rows} setRows={setRows}
    columns={[{key:'date',label:'Date (DD-MMM-YYYY)'},{key:'source',label:'Source'},{key:'amount',label:'Amount',type:'number',render:(v)=> currency(Number(v))},{key:'tags',label:'Tags'}]}
    filters={[...new Set(rows.flatMap(r=> String(r.tags||'').split(',').map(s=> s.trim()).filter(Boolean)))]}
    pillField="tags" pagination />)
}
function BillsPage({ rows, setRows, categoryOptions }){
  // Build multi-select category pills
  const allCats = Array.from(new Set(rows.map(r=> r.category || 'Uncategorized'))).sort()
  return (<TablePage title="Bills" rows={rows} setRows={setRows}
    columns={[
      {key:'due',label:'Due (DD-MMM-YYYY)'},
      {key:'name',label:'Bill'},
      {key:'category',label:'Category', input:'select', options: categoryOptions},
      {key:'amount',label:'Amount',type:'number',render:(v)=> currency(Number(v))},
      {key:'status',label:'Status'}
    ]}
    // enable multi-select filter via supplied options
    multiFilters={{ categories: allCats }}
    pillField="status" enableEdit pagination />)
}

// Generic page with pagination, multi-select category pills, alternating stripes, wrapping cells
function TablePage({ title, columns, rows, setRows, filters=[], pillField, enableEdit=false, pagination=false, multiFilters={} }){
  const [sort, setSort] = useState({ key: columns[0].key, dir: 'asc' })
  const [active, setActive] = useState('all')
  const [showAdd, setShowAdd] = useState(true)
  const [editId, setEditId] = useState(null)
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [activeCats, setActiveCats] = useState([]) // for category multi-select

  const sorted = useMemo(()=> [...rows].sort((a,b)=> sort.dir==='asc' ? (a[sort.key]>b[sort.key]?1:-1) : (a[sort.key]<b[sort.key]?1:-1)), [rows, sort])

  // Filter by status pill (if provided) + multi category filter
  const filtered = useMemo(()=> {
    let data = sorted
    if (pillField && active!=='all') {
      data = data.filter(r => String(r[pillField]).split(',').map(s=> s.trim()).includes(String(active)))
    }
    if (multiFilters.categories && activeCats.length>0) {
      data = data.filter(r => activeCats.includes(r.category || 'Uncategorized'))
    }
    return data
  }, [sorted, active, pillField, multiFilters, activeCats])

  const totalPages = Math.max(1, Math.ceil(filtered.length / (pageSize||filtered.length)))
  const pageData = pagination && pageSize !== 0 ? filtered.slice((page-1)*pageSize, (page)*pageSize) : filtered

  const empty = Object.fromEntries(columns.map(c=> [c.key, c.type==='number'? 0 : '']))
  const [form, setForm] = useState(empty)

  const addRow = () => { setRows(prev=> [{ id: crypto.randomUUID(), ...form }, ...prev]); setForm(empty) }
  const remove = (id) => setRows(prev => prev.filter(r => r.id !== id))
  const startEdit = (row) => { setEditId(row.id); setForm(columns.reduce((acc,c)=> ({...acc, [c.key]: row[c.key] ?? (c.type==='number'?0:'')}), {})) }
  const saveEdit = () => { setRows(prev => prev.map(r => r.id===editId? { ...r, ...form } : r)); setEditId(null); setForm(empty) }
  const cancelEdit = () => { setEditId(null); setForm(empty) }

  const toggleCat = (c) => setActiveCats(prev => prev.includes(c) ? prev.filter(x=> x!==c) : [...prev, c])

  useEffect(()=> { setPage(1) }, [pageSize, active, activeCats, rows])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>

      {/* Collapsible Add New above pills */}
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
                    <input className="px-3 py-2 rounded-lg bg-stone-100 text-sm w-full wrap" placeholder={col.label} type={col.type==='number'?'number':'text'} value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: col.type==='number'? Number(e.target.value) : e.target.value}))}/>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-2"><button className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm" onClick={addRow}>Add</button></div>
          </div>
        )}
      </div>

      {/* Status filter pills */}
      {filters.length>0 && (
        <div className="flex flex-wrap gap-2">
          <button className={`px-2 py-1 rounded-full text-xs ${active==='all'?'bg-stone-800 text-white':'bg-stone-200'}`} onClick={()=> setActive('all')}>All</button>
          {filters.map((f,i)=> (
            <button key={i} className={`px-2 py-1 rounded-full text-xs ${active===f?'bg-stone-800 text-white':'bg-stone-200'}`} onClick={()=> setActive(f)}>{f}</button>
          ))}
        </div>
      )}

      {/* Category multi-select pills */}
      {multiFilters.categories && (
        <div className="flex flex-wrap gap-2">
          {multiFilters.categories.map(c => (
            <button key={c} onClick={()=> toggleCat(c)}
              className={`px-2 py-1 rounded-full text-xs border ${activeCats.includes(c)?'bg-blue-100 border-blue-300':'bg-stone-200 border-stone-300'}`}>
              {c}
            </button>
          ))}
          {activeCats.length>0 && <button className="px-2 py-1 rounded-full text-xs bg-stone-300" onClick={()=> setActiveCats([])}>Clear</button>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm">
        <table className="w-full text-sm table-fixed">
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
            {pageData.map((row, idx) => {
              const isEditing = enableEdit && row.id === editId
              return (
                <tr key={row.id || idx} className={`${idx % 2 === 0 ? 'bg-stone-50' : 'bg-white'} border-t border-stone-200`}>
                  {columns.map(col => (
                    <td key={col.key} className="py-2 px-3 whitespace-normal wrap">
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

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-stone-600">Rows per page:</span>
        <select className="bg-stone-100 rounded px-2 py-1 text-sm" value={pageSize} onChange={e=> setPageSize(Number(e.target.value))}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={0}>All</option>
        </select>
        {pageSize!==0 && (
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded bg-stone-200" onClick={()=> setPage(p=> Math.max(1, p-1))}>Prev</button>
            <span className="text-sm">Page {page} / {totalPages}</span>
            <button className="px-2 py-1 rounded bg-stone-200" onClick={()=> setPage(p=> Math.min(totalPages, p+1))}>Next</button>
          </div>
        )}
        <div className="ml-auto text-sm text-stone-600">{rows.length} total rows</div>
      </div>
    </div>
  )
}
