import React, { useMemo, useState } from 'react'
import { NavLink, Routes, Route } from 'react-router-dom'
import Papa from 'papaparse'

const currency = (n) => (Number(n)||0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// Seed data with Day-Month-Year format
const seedCategories = [
  { id: 'cat-utilities', name: 'Utilities', type: 'Expense' },
  { id: 'cat-insurance', name: 'Insurance', type: 'Expense' },
  { id: 'cat-shopping', name: 'Shopping', type: 'Expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'Expense' },
  { id: 'cat-dining', name: 'Dining', type: 'Expense' },
  { id: 'cat-income', name: 'Income', type: 'Income' },
  { id: 'cat-savings', name: 'Savings', type: 'Savings' },
  { id: 'cat-misc', name: 'Misc', type: 'Expense' },
]
const seedIncome = [
  { id: 'inc-1', date: '01-Jul-2025', source: 'Paycheck', amount: 2500, tags: ['salary'] },
  { id: 'inc-2', date: '15-Jul-2025', source: 'Paycheck', amount: 2500, tags: ['salary'] },
  { id: 'inc-3', date: '20-Jul-2025', source: 'Freelance', amount: 600, tags: ['side'] },
]
const seedBills = [
  { id: 'bill-1', due: '20-Jul-2025', name: 'Electricity', category: 'Utilities', amount: 150, status: 'due' },
  { id: 'bill-2', due: '25-Jul-2025', name: 'Internet', category: 'Utilities', amount: 80, status: 'paid' },
  { id: 'bill-3', due: '10-Jul-2025', name: 'Allstate Insurance', category: 'Insurance', amount: 460, status: 'paid' },
  { id: 'bill-4', due: '05-Jul-2025', name: 'Groceries (weekly)', category: 'Groceries', amount: 200, status: 'due' },
]

export default function App(){
  const [categories, setCategories] = useState(seedCategories)
  const [income, setIncome] = useState(seedIncome)
  const [bills, setBills] = useState(seedBills)
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetRows, setSheetRows] = useState([])

  // CSV upload
  const onUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, { header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (res)=> setSheetRows(res.data||[]) })
  }
  const loadSheet = async () => {
    if (!sheetUrl) return;
    const res = await fetch(sheetUrl, { cache: 'no-store' })
    const text = await res.text()
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
    setSheetRows(parsed.data||[]);
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
            <div className="mt-4 border-t border-stone-200 pt-3 text-sm">
              <div className="font-medium mb-2">Data (Google Sheet / CSV)</div>
              <input className="w-full text-sm px-3 py-2 rounded-lg bg-stone-100" placeholder="Published CSV URL" value={sheetUrl} onChange={(e)=> setSheetUrl(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button className="px-3 py-1.5 rounded-lg bg-stone-800 text-white text-sm" onClick={loadSheet}>Load</button>
                <label className="px-3 py-1.5 rounded-lg bg-stone-700 text-white text-sm cursor-pointer">
                  Upload CSV<input type="file" accept=".csv" className="hidden" onChange={onUpload}/>
                </label>
              </div>
              <div className="text-xs text-stone-500 mt-2">{sheetRows.length} rows loaded</div>
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

  const monthIndex = (dateStr) => {
    // expects DD-MMM-YYYY
    const m = (dateStr||'').split('-')[1]
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m)
  }
  const byMonth = (rows, key) => {
    const m = new Map(months.map((_,i)=> [i,0]))
    rows.forEach(r=> {
      const d = key==='income' ? r.date : r.due
      const idx = monthIndex(d)
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Income by Month"><MiniBars labels={months} values={incSeries} max={maxBar} color="bg-emerald-600" /></Card>
        <Card title="Expenses by Month"><MiniBars labels={months} values={expSeries} max={maxBar} color="bg-rose-600" /></Card>
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
    filters={[...new Set(rows.flatMap(r=> Array.isArray(r.tags)? r.tags : (r.tags? String(r.tags).split(',').map(s=> s.trim()) : [])))]}
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
    filters={[...new Set(rows.map(r=> r.status))]} pillField="status" enableEdit />)
}

// Generic table with Add/Delete/Edit, alternating row shading, collapsible Add box
function TablePage({ title, columns, rows, setRows, filters=[], pillField, enableEdit=false }){
  const [sort, setSort] = useState({ key: columns[0].key, dir: 'asc' })
  const [active, setActive] = useState('all')
  const [showAdd, setShowAdd] = useState(true)
  const [editId, setEditId] = useState(null)
  const sorted = useMemo(()=> [...rows].sort((a,b)=> sort.dir==='asc' ? (a[sort.key]>b[sort.key]?1:-1) : (a[sort.key]<b[sort.key]?1:-1)), [rows, sort])
  const filtered = useMemo(()=> {
    if (!pillField || active==='all') return sorted
    return sorted.filter(r => {
      const val = r[pillField]
      if (Array.isArray(val)) return val.map(String).includes(String(active))
      return String(val) === String(active)
    })
  }, [sorted, active, pillField])

  const empty = Object.fromEntries(columns.map(c=> [c.key, c.type==='number'? 0 : '']))
  const [form, setForm] = useState(empty)

  const addRow = () => { setRows(prev=> [...prev, { id: crypto.randomUUID(), ...form }]); setForm(empty) }
  const remove = (id) => setRows(prev => prev.filter(r => r.id !== id))

  const startEdit = (row) => { setEditId(row.id); setForm(columns.reduce((acc,c)=> ({...acc, [c.key]: row[c.key] ?? (c.type==='number'?0:'')}), {})) }
  const saveEdit = () => { setRows(prev => prev.map(r => r.id===editId? { ...r, ...form } : r)); setEditId(null); setForm(empty) }
  const cancelEdit = () => { setEditId(null); setForm(empty) }

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
                    <input className="px-3 py-2 rounded-lg bg-stone-100 text-sm w-full" placeholder={col.label} type={col.type==='number'?'number':'text'} value={form[col.key]} onChange={(e)=> setForm(f=> ({...f, [col.key]: col.type==='number'? Number(e.target.value) : e.target.value}))}/>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-2"><button className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm" onClick={addRow}>Add</button></div>
          </div>
        )}
      </div>

      {/* Filter pills */}
      {filters.length>0 && (
        <div className="flex flex-wrap gap-2">
          <button className={`px-2 py-1 rounded-full text-xs ${active==='all'?'bg-stone-800 text-white':'bg-stone-200'}`} onClick={()=> setActive('all')}>All</button>
          {filters.map((f,i)=> (
            <button key={i} className={`px-2 py-1 rounded-full text-xs ${active===f?'bg-stone-800 text-white':'bg-stone-200'}`} onClick={()=> setActive(f)}>{f}</button>
          ))}
        </div>
      )}

      {/* Table with alternating row shading */}
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
            {filtered.map((row, idx) => {
              const isEditing = enableEdit && row.id === editId
              return (
                <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-stone-50' : 'bg-white'} border-t border-stone-200`}>
                  {columns.map(col => (
                    <td key={col.key} className="py-2 px-3 whitespace-nowrap">
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
    </div>
  )
}
